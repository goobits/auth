import { createAuth } from '@goobits/auth'
import { D1SessionAdapter, D1UserAdapter } from '@goobits/auth/adapters'
import { GoogleProvider, AppleProvider } from '@goobits/auth/providers'
import { dev } from '$app/environment'
import { hasUserRedeemedAnyInvite, validateInvite, consumeInvite } from '@packages/calendar/src/calendar/invites.js'
import { redirect } from '@sveltejs/kit'

const INVITE_COOKIE = 'calendar_invite'
const REDIRECT_COOKIE = 'calendar_redirect'
const INVITE_TTL_SECONDS = 600
const SAFE_REDIRECT_PREFIXES = ['/calendar', '/calendar-gym', '/admin']

let cachedDevDb = null

async function getDb(platform) {
	if (dev) {
		if (!cachedDevDb) {
			const { createSqliteDb } = await import('$lib/dev/sqliteDb.js')
			cachedDevDb = createSqliteDb()
		}
		return cachedDevDb
	}
	return platform?.env?.DB || null
}

function getBaseUrl({ env, url }) {
	return env.PUBLIC_BASE_URL || env.BASE_URL || url?.origin || ''
}

function normalizeRedirect(redirectTo) {
	if (!redirectTo || typeof redirectTo !== 'string') return null
	const trimmed = redirectTo.trim()
	if (!trimmed.startsWith('/')) return null
	if (trimmed.startsWith('//')) return null
	if (trimmed.includes('\\')) return null
	if (/[\r\n]/.test(trimmed)) return null
	if (!SAFE_REDIRECT_PREFIXES.some(prefix => trimmed.startsWith(prefix))) return null
	return trimmed
}

export async function getCalendarAuth({ event }) {
	const db = await getDb(event.platform)
	if (!db) throw new Error('Database unavailable')

	const env = event.platform?.env || process.env || {}
	const baseUrl = getBaseUrl({ env, url: event.url })
	const secureCookies = env.NODE_ENV !== 'development'

	const sessionAdapter = new D1SessionAdapter(db, {
		sessionsTable: 'calendar_sessions',
		usersTable: 'calendar_users',
		cookieName: 'calendar_session',
		secureCookies,
		sessionLifetime: 7 * 24 * 60 * 60 * 1000,
		userColumns: {
			id: 'id',
			email: 'email',
			name: 'name',
			avatar: 'avatar_url',
			password: 'password',
			emailVerified: 'email_verified'
		}
	})

	const databaseAdapter = new D1UserAdapter(db, {
		usersTable: 'calendar_users',
		oauthAccountsTable: 'calendar_oauth_accounts',
		columns: {
			id: 'id',
			email: 'email',
			name: 'name',
			avatar: 'avatar_url',
			emailVerified: 'email_verified',
			password: 'password'
		},
		oauthColumns: {
			userId: 'user_id',
			provider: 'provider',
			providerAccountId: 'provider_account_id'
		}
	})

	const providers = {}
	if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
		providers.google = {
			provider: new GoogleProvider({
				clientId: env.GOOGLE_CLIENT_ID,
				clientSecret: env.GOOGLE_CLIENT_SECRET,
				callbackUrl: env.GOOGLE_REDIRECT_URI || `${baseUrl}/api/calendar/oauth-callback`
			}),
			scopes: ['openid', 'profile', 'email']
		}
	}

	if (env.APPLE_CLIENT_ID && env.APPLE_TEAM_ID && env.APPLE_KEY_ID && env.APPLE_PRIVATE_KEY) {
		providers.apple = {
			provider: new AppleProvider({
				clientId: env.APPLE_CLIENT_ID,
				teamId: env.APPLE_TEAM_ID,
				keyId: env.APPLE_KEY_ID,
				privateKey: env.APPLE_PRIVATE_KEY,
				callbackUrl: env.APPLE_REDIRECT_URI || `${baseUrl}/api/calendar/oauth-callback`
			})
		}
	}

	const auth = createAuth({
		adapters: {
			session: sessionAdapter,
			database: databaseAdapter
		},
		providers,
		urls: {
			afterLogin: '/calendar/login/redirect',
			afterLogout: '/calendar/login'
		},
		sessions: {},
		hooks: {
			onLogin: async (evt, profile, _tokens, user) => {
				const invite = evt.cookies.get(INVITE_COOKIE)
				const redirectTo = evt.cookies.get(REDIRECT_COOKIE)

				if (invite) {
					evt.cookies.delete(INVITE_COOKIE, { path: '/' })
				}
				if (redirectTo) {
					evt.cookies.delete(REDIRECT_COOKIE, { path: '/' })
				}

				if (user) {
					const hasRedeemed = await hasUserRedeemedAnyInvite({ db, userId: user.id })
					if (!hasRedeemed) {
						if (!invite) {
							throw redirect(302, '/calendar/login?error=invite_required')
						}

						const result = await validateInvite({ db, code: invite, email: profile.email })
						if (!result.valid) {
							throw redirect(302, `/calendar/login?error=invite_${result.reason}`)
						}

						await consumeInvite({ db, inviteId: result.invite.id, userId: user.id })
					}

					await db.prepare(
						`UPDATE calendar_users SET last_login_at = strftime('%s','now') WHERE id = ?`
					).bind(user.id).run()
				}

				const session = await sessionAdapter.createSession(user.id)
				sessionAdapter.setSessionCookie(evt.cookies, session)

				if (redirectTo) {
					evt.cookies.set(REDIRECT_COOKIE, redirectTo, {
						httpOnly: true,
						secure: secureCookies,
						sameSite: 'lax',
						path: '/',
						maxAge: INVITE_TTL_SECONDS
					})
				}

				return { userId: user.id }
			}
		}
	})

	return { auth, db, env, secureCookies }
}

export function setCalendarLoginContext(cookies, { invite, redirectTo, secure }) {
	if (invite) {
		cookies.set(INVITE_COOKIE, invite, {
			httpOnly: true,
			secure,
			sameSite: 'lax',
			path: '/',
			maxAge: INVITE_TTL_SECONDS
		})
	}
	const safeRedirect = normalizeRedirect(redirectTo)
	if (safeRedirect) {
		cookies.set(REDIRECT_COOKIE, safeRedirect, {
			httpOnly: true,
			secure,
			sameSite: 'lax',
			path: '/',
			maxAge: INVITE_TTL_SECONDS
		})
	}
}

export function getCalendarRedirect(cookies) {
	const redirectTo = cookies.get(REDIRECT_COOKIE)
	if (redirectTo) {
		cookies.delete(REDIRECT_COOKIE, { path: '/' })
		return normalizeRedirect(redirectTo)
	}
	return null
}
