import { GoobitsAuth } from '@goobits/auth'
import { D1SessionAdapter, D1UserAdapter } from '@goobits/auth/adapters'
import { GoogleProvider, AppleProvider } from '@goobits/auth/providers'
import type { OAuthProfile, OAuthTokens, RequestEventLike, User } from '@goobits/auth/types'
import { dev } from '$app/environment'
import { hasUserRedeemedAnyInvite, validateInvite, consumeInvite } from '@packages/calendar/src/calendar/invites.ts'
import { redirect } from '@sveltejs/kit'
import type { Cookies } from '@sveltejs/kit'
import { getDevDb, type D1DatabaseLike } from '$lib/dev/devDb.ts'

const INVITE_COOKIE = 'calendar_invite'
const REDIRECT_COOKIE = 'calendar_redirect'
const INVITE_TTL_SECONDS = 600
const SAFE_REDIRECT_PREFIXES = ['/calendar', '/admin']
const INVITE_BYPASS_DOMAIN = '@miko.art'

type PlatformEnv = {
	DB?: D1DatabaseLike
	NODE_ENV?: string
	PUBLIC_BASE_URL?: string
	BASE_URL?: string
	GOOGLE_CLIENT_ID?: string
	GOOGLE_CLIENT_SECRET?: string
	GOOGLE_REDIRECT_URI?: string
	GOOGLE_AUTH_REDIRECT_URI?: string
	APPLE_CLIENT_ID?: string
	APPLE_TEAM_ID?: string
	APPLE_KEY_ID?: string
	APPLE_PRIVATE_KEY?: string
	APPLE_REDIRECT_URI?: string
	APPLE_AUTH_REDIRECT_URI?: string
	[key: string]: string | D1DatabaseLike | undefined
}
type PlatformLike = { env?: PlatformEnv } | null | undefined

async function getDb(platform: PlatformLike) {
	if (dev) {
		return await getDevDb()
	}
	return platform?.env?.DB || null
}

function getBaseUrl({ env, url }: { env: Record<string, string | undefined>; url: URL }) {
	return env['PUBLIC_BASE_URL'] || env['BASE_URL'] || url?.origin || ''
}

function normalizeRedirect(redirectTo: unknown) {
	if (!redirectTo || typeof redirectTo !== 'string') return null
	const trimmed = redirectTo.trim()
	if (!trimmed.startsWith('/')) return null
	if (trimmed.startsWith('//')) return null
	if (trimmed.includes('\\')) return null
	if (/[\r\n]/.test(trimmed)) return null
	if (!SAFE_REDIRECT_PREFIXES.some(prefix => trimmed.startsWith(prefix))) return null
	return trimmed
}

export async function getCalendarAuth({ event }: { event: { platform?: PlatformLike; url: URL } }) {
	const db = await getDb(event.platform)
	if (!db) throw new Error('Database unavailable')

	const env = {
		...Object.fromEntries(
			Object.entries(process.env).filter(([, value]) => typeof value === 'string')
		),
		...(event.platform?.env ?? {})
	} as Record<string, string | undefined>
	const baseUrl = getBaseUrl({ env, url: event.url })
	const secureCookies = env['NODE_ENV'] !== 'development'

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

	const userAdapter = new D1UserAdapter(db, {
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

	const providers: {
		google?: { provider: InstanceType<typeof GoogleProvider>; scopes: string[] }
		apple?: { provider: InstanceType<typeof AppleProvider> }
	} = {}
	if (env['GOOGLE_CLIENT_ID'] && env['GOOGLE_CLIENT_SECRET']) {
		providers['google'] = {
			provider: new GoogleProvider({
				clientId: env['GOOGLE_CLIENT_ID'],
				clientSecret: env['GOOGLE_CLIENT_SECRET'],
				callbackUrl: env['GOOGLE_AUTH_REDIRECT_URI'] || `${baseUrl}/auth/google/callback`
			}),
			scopes: ['openid', 'profile', 'email']
		}
	}

	if (env['APPLE_CLIENT_ID'] && env['APPLE_TEAM_ID'] && env['APPLE_KEY_ID'] && env['APPLE_PRIVATE_KEY']) {
		providers['apple'] = {
			provider: new AppleProvider({
				clientId: env['APPLE_CLIENT_ID'],
				teamId: env['APPLE_TEAM_ID'],
				keyId: env['APPLE_KEY_ID'],
				privateKey: env['APPLE_PRIVATE_KEY'],
				callbackUrl: env['APPLE_AUTH_REDIRECT_URI'] || `${baseUrl}/auth/apple/callback`
			})
		}
	}

	const auth = new GoobitsAuth({
		adapter: {
			session: sessionAdapter,
			user: userAdapter
		},
		cookies: {
			secure: secureCookies
		},
		providers,
		urls: {
			afterLogin: '/calendar/login/redirect',
			afterLogout: '/calendar/login'
		},
		profile: 'secure',
		sessions: {},
		hooks: {
			onLogin: async (evt: RequestEventLike, profile: OAuthProfile, _tokens: OAuthTokens | null, user?: User | null) => {
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
					const normalizedEmail = (profile.email || '').trim().toLowerCase()
					const canBypassInvite = normalizedEmail.endsWith(INVITE_BYPASS_DOMAIN)
					if (!hasRedeemed) {
						if (!canBypassInvite) {
							if (!invite) {
								throw redirect(302, '/calendar/login?error=invite_required')
							}
							const result = await validateInvite({ db, code: invite, email: profile.email })
							if (!result.valid) {
								throw redirect(302, `/calendar/login?error=invite_${result.reason}`)
							}
							if (!result.invite || typeof result.invite.id !== 'number') {
								throw redirect(302, '/calendar/login?error=invite_invalid')
							}

							await consumeInvite({ db, inviteId: result.invite.id, userId: user.id })
						}
					}

					await db.prepare(
						`UPDATE calendar_users SET last_login_at = strftime('%s','now') WHERE id = ?`
					).bind(user.id).run()
				}

				if (!user) {
					throw redirect(302, '/calendar/login?error=signin_failed')
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
			},
			onError: async (_evt: RequestEventLike, error: unknown) => {
				const isRedirect = (
					typeof error === 'object' &&
					error !== null &&
					'status' in error &&
					'location' in error &&
					typeof (error as { status?: unknown }).status === 'number'
				)
				if (isRedirect) return
				console.error('[calendar auth] oauth callback error', error)
			}
		}
	})

	return { auth, db, env, secureCookies }
}

export function setCalendarLoginContext(
	cookies: Pick<Cookies, 'set'>,
	{ invite, redirectTo, secure }: { invite?: string; redirectTo?: string; secure: boolean }
) {
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

export function getCalendarRedirect(cookies: Pick<Cookies, 'get' | 'delete'>) {
	const redirectTo = cookies.get(REDIRECT_COOKIE)
	if (redirectTo) {
		cookies.delete(REDIRECT_COOKIE, { path: '/' })
		return normalizeRedirect(redirectTo)
	}
	return null
}
