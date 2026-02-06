import { getAdminAuth, ensureAdminAccount } from '$lib/auth/admin.ts'
import { createSigninHandler, createLogoutHandler } from '@goobits/auth/handlers'
import { checkRateLimit } from '@packages/calendar/src/index.ts'
import { logAdminEvent } from '../api/admin/_helpers.ts'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async (event) => {
	const locals = event.locals as { user?: Record<string, unknown> }
	return { user: locals.user ?? null }
}

export const actions: Actions = {
	login: async (event) => {
		const { credentialsProvider, userAdapter, sessionAdapter, env, db } = await getAdminAuth({ event })
		await ensureAdminAccount({ userAdapter, env })

		return createSigninHandler({
			credentialsProvider,
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
