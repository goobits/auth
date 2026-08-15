import { createLogoutHandler } from '../handlers/logout.ts'
import {
	createCurrentSessionHandler,
	createSessionListHandler,
	createSessionRevokeHandler
} from '../handlers/sessions.ts'
import { createAuthCsrf } from '../security/policy.ts'
import type { AuthConfig, AuthHandlers, AuthLocals, RequestEventLike } from '../types/auth.ts'
import type { User } from '../types/index.ts'
import type { ResolvedDefaults } from './config.ts'
import type { ResolvedSecurity } from './securitySetup.ts'

type SessionHandlers = Pick<AuthHandlers, 'logout' | 'hooks' | 'currentSession'> &
	Partial<Pick<AuthHandlers, 'sessions'>>

export function createSessionHandlers(
	config: AuthConfig,
	defaults: ResolvedDefaults,
	security: ResolvedSecurity
): SessionHandlers {
	const { adapters, hooks = {}, sessions, sanitizeUser = (user: User | null) => user } = config
	const { urlConfig, isAuthenticated } = defaults
	const csrf = security.csrf.mode === 'off' ? null : createAuthCsrf(security)
	const logout = createLogoutHandler({
		sessionAdapter: adapters.session,
		redirectAfterLogout: urlConfig.afterLogout,
		getSession: (locals: AuthLocals) => locals.session ?? null,
		...(config.logger ? { logger: config.logger } : {}),
		...(hooks.onLogout
			? {
					onLogout: async (event: RequestEventLike) => {
						await hooks.onLogout?.(event)
					}
				}
			: {})
	})

	const handleHooks: AuthHandlers['hooks'] = async ({ event, resolve }) => {
		const method = event.request.method.toUpperCase()
		const safeMethod = method === 'GET' || method === 'HEAD' || method === 'OPTIONS'
		const resolveWithCsrf = async () => {
			if (safeMethod && csrf) await csrf.getOrCreate(event as never)
			return resolve(event)
		}
		const sessionId = event.cookies.get(adapters.session.cookieName)
		if (!sessionId) {
			event.locals.session = null
			event.locals.user = null
			return resolveWithCsrf()
		}
		const { session, user } = await adapters.session.validateSession(sessionId)
		event.locals.session = session
		event.locals.user = sanitizeUser(user)
		if (session && user) {
			await hooks.onSessionValidated?.(event, session, user)
			if (session.fresh) adapters.session.setSessionCookie?.(event.cookies, session)
		} else {
			adapters.session.deleteSessionCookie?.(event.cookies)
		}
		return resolveWithCsrf()
	}

	return {
		currentSession: createCurrentSessionHandler({ isAuthenticated, sanitizeUser }),
		logout,
		hooks: handleHooks,
		...(sessions
			? {
					sessions: {
						list: createSessionListHandler({
							...sessions,
							sessionAdapter: adapters.session,
							isAuthenticated
						}),
						revoke: createSessionRevokeHandler({
							...sessions,
							sessionAdapter: adapters.session,
							isAuthenticated
						})
					}
				}
			: {})
	}
}
