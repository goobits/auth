import { getAdminAuth, ensureAdminAccount } from '$lib/auth/admin.ts'
import { createSigninHandler, createLogoutHandler } from '@goobits/auth/handlers'
import { checkRateLimit } from '@packages/calendar/src/index.ts'
import { logAdminEvent } from '../api/admin/_helpers.ts'
import type { Actions, PageServerLoad } from './$types'
import type { User } from '@goobits/auth/types'

function isAuthUser(value: unknown): value is User {
	if (!value || typeof value !== 'object') return false
	const record = value as Record<string, unknown>
	return (typeof record['id'] === 'string' || typeof record['id'] === 'number')
		&& typeof record['email'] === 'string'
}

export const load: PageServerLoad = async (event) => {
	const locals = event.locals as { user?: Record<string, unknown> }
	return { user: locals.user ?? null, initialTab: 'dash' }
}

export const actions: Actions = {
	login: async (event) => {
		const { credentialsProvider, userAdapter, sessionAdapter, env, db } = await getAdminAuth({ event })
		await ensureAdminAccount({ userAdapter, env })
		type CredentialsInput = Parameters<typeof credentialsProvider.authenticate>[0]

		return await createSigninHandler({
			credentialsProvider: {
				authenticate: async ({ email, password, userAdapter: adapter }: { email: string; password: string; userAdapter: unknown }) => {
					const result = await credentialsProvider.authenticate({
						email,
						password,
						userAdapter: adapter as CredentialsInput['userAdapter']
					})
					return {
						user: isAuthUser(result.user) ? result.user : null,
						valid: result.valid
					}
				}
			},
			userAdapter,
			sessionAdapter,
			redirectTo: '/admin',
			rateLimit: {
				check: async (key: string) => {
					try {
						return await checkRateLimit({ db, key: `rate:admin_login:${key}`, limit: 10, windowSeconds: 60 })
					} catch {
						return { allowed: true }
					}
				}
			},
			onSignin: () => {
				logAdminEvent(event, 'login_success')
			}
		})(event)
	},

	logout: async (event) => {
		const { sessionAdapter } = await getAdminAuth({ event })
		return createLogoutHandler({ sessionAdapter, redirectAfterLogout: '/admin' })(event)
	}
}
