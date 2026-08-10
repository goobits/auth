import { error, type Handle, redirect } from '@sveltejs/kit'

import { createAuth } from './createAuth.ts'
import { AUTH_ROUTE_PATHS, matchesAuthRoute, normalizeAuthBasePath } from './_routePaths.ts'
import { createAuthEvent, type AuthEvent } from './security/events.ts'
import type { AuthConfig, AuthLocals, AuthRequestHandler, RequestEventLike } from './types/auth.ts'
import type { AuthSession, User } from './types/index.ts'

type HandlerMethod = 'GET' | 'POST'

type AuthPrincipal = {
	session: AuthSession
	user: User
}

type AuthHandlersBundle = {
	GET: AuthRequestHandler
	POST: AuthRequestHandler
}

type AuthRoleResolver = (user: User) => string[] | Promise<string[]>

/** Route paths used by the SvelteKit auth integration. */
export type GoobitsAuthRoutingConfig = {
	basePath?: string
	signInPath?: string
	signOutPath?: string
}

/** Configuration for the high-level Goobits auth facade. */
type GoobitsAuthFacadeOptions = {
	/** Trusted application resolver for website/session authorization roles. */
	resolveAuthRoles?: AuthRoleResolver
	routing?: GoobitsAuthRoutingConfig
}

type GoobitsAuthConfigFor<T extends AuthConfig> = T extends AuthConfig
	? Omit<T, 'adapters'> & { adapter: T['adapters'] } & GoobitsAuthFacadeOptions
	: never

/** Configuration for the high-level Goobits auth facade. */
export type GoobitsAuthConfig = GoobitsAuthConfigFor<AuthConfig>

/** Application-owned auth event accepted by the configured audit and alert pipeline. */
export type AuthSecurityEventInput = Omit<AuthEvent, 'timestamp'>

type HandlerTarget = {
	method: HandlerMethod
	handler: AuthRequestHandler
}

type CoreAuth = ReturnType<typeof createAuth>

type LocalsWithAuth = AuthLocals & {
	auth?: AuthPrincipal | null
}

function splitRoutedPath(pathname: string, basePath: string): string[] {
	if (pathname !== basePath && !pathname.startsWith(`${basePath}/`)) return []
	const rest = pathname.slice(basePath.length)
	const normalized = rest.startsWith('/') ? rest.slice(1) : rest
	if (!normalized) return []
	return normalized.split('/').filter((part) => part.length > 0)
}

function hasSessionPrincipal(locals: AuthLocals): locals is AuthLocals & {
	session: AuthSession
	user: User
} {
	return !!locals.session && !!locals.user
}

function resolveUserAuthRoles(user: User): string[] {
	return typeof user.role === 'string' && user.role.length > 0 ? [user.role] : []
}

/** High-level SvelteKit auth facade with handlers, hooks, and role guards. */
export class GoobitsAuth {
	private readonly core: CoreAuth
	private readonly routing: Required<GoobitsAuthRoutingConfig>
	private readonly defaultHandlers: AuthHandlersBundle
	private readonly resolveAuthRoles: AuthRoleResolver

	constructor(config: GoobitsAuthConfig) {
		const { routing, adapter, resolveAuthRoles, ...rest } = config
		const authConfig = {
			...rest,
			adapters: adapter
		} as AuthConfig
		this.core = createAuth(authConfig)
		this.resolveAuthRoles = resolveAuthRoles ?? resolveUserAuthRoles
		const basePath = normalizeAuthBasePath(routing?.basePath ?? '/auth')
		this.routing = {
			basePath,
			signInPath: routing?.signInPath ?? `${basePath}/signin`,
			signOutPath: routing?.signOutPath ?? `${basePath}/signout`
		}
		this.defaultHandlers = this.createHandlers()
	}

	get adapter() {
		return this.core.adapters
	}

	/**
	 * Sends an application-owned authentication event through the same audit,
	 * threshold, and alert pipeline used by Goobits-managed routes.
	 */
	async emitSecurityEvent(event: AuthSecurityEventInput): Promise<void> {
		await this.core.security.audit.emitter?.(createAuthEvent(event))
	}

	get providers() {
		return this.core.providers
	}

	get handlers(): AuthHandlersBundle {
		return this.defaultHandlers
	}

	/** Named action factories for applications that mount auth form actions. */
	get actions(): CoreAuth['actions'] {
		return this.core.actions
	}

	/** Named route factories for applications that mount individual auth endpoints. */
	get routes(): CoreAuth['routes'] {
		return this.core.routes
	}

	/**
	 * Creates a SvelteKit handle hook that validates sessions and populates auth locals.
	 */
	handle(): Handle {
		return async ({ event, resolve }) => {
			const baseEvent = event as unknown as RequestEventLike
			const response = await this.core.handlers.hooks({
				event: baseEvent,
				resolve: async (nextEvent) => {
					const locals = nextEvent.locals as LocalsWithAuth
					locals.auth = hasSessionPrincipal(nextEvent.locals)
						? { session: nextEvent.locals.session, user: nextEvent.locals.user }
						: null
					return resolve(nextEvent as never)
				}
			})
			const locals = event.locals as LocalsWithAuth
			if (locals.auth === undefined) {
				locals.auth = hasSessionPrincipal(locals)
					? { session: locals.session, user: locals.user }
					: null
			}
			return response
		}
	}

	createHandlers(options?: { basePath?: string }): AuthHandlersBundle {
		const basePath = normalizeAuthBasePath(options?.basePath ?? this.routing.basePath)
		const dispatch: AuthRequestHandler = async (event) => {
			const method = event.request.method.toUpperCase()
			if (method !== 'GET' && method !== 'POST') {
				return new Response('Method Not Allowed', { status: 405 })
			}
			const segments = splitRoutedPath(event.url.pathname, basePath)
			const target = this.resolveTarget({
				event: event as unknown as RequestEventLike,
				segments,
				method
			})
			if (!target) {
				return new Response('Not Found', { status: 404 })
			}
			if (target.method !== method) {
				return new Response('Method Not Allowed', { status: 405 })
			}
			return target.handler(event)
		}
		return {
			GET: dispatch,
			POST: dispatch
		}
	}

	/**
	 * Reads the current request session and caches the principal on event locals.
	 *
	 * @param event - Event payload.
	 */
	async getSession(event: RequestEventLike): Promise<AuthPrincipal | null> {
		if (hasSessionPrincipal(event.locals)) {
			return {
				session: event.locals.session,
				user: event.locals.user
			}
		}
		const sessionAdapter = this.core.adapters.session
		const sessionId = event.cookies.get(sessionAdapter.cookieName)
		if (!sessionId) {
			return null
		}
		const { session, user } = await sessionAdapter.validateSession(sessionId)
		event.locals.session = session
		event.locals.user = user
		const locals = event.locals as LocalsWithAuth
		locals.auth = session && user ? { session, user } : null
		return locals.auth
	}

	/**
	 * Returns the current user or redirects to the configured sign-in route.
	 *
	 * @param event - Event payload.
	 */
	async requireUser(event: RequestEventLike): Promise<User> {
		const principal = await this.getSession(event)
		if (!principal) {
			throw redirect(302, this.routing.signInPath)
		}
		return principal.user
	}

	/**
	 * Returns the current user when they have any required route-auth role, otherwise throws a 403.
	 *
	 * @param event - Event payload.
	 * @param authRole - route-auth role value.
	 */
	async requireAuthRole(event: RequestEventLike, authRole: string | string[]): Promise<User> {
		const user = await this.requireUser(event)
		const authRoles = Array.from(new Set(await this.resolveAuthRoles(user)))
		const required = Array.isArray(authRole) ? authRole : [authRole]
		const allowed = required.some((entry) => authRoles.includes(entry))
		if (!allowed) {
			const emitter = this.core.security.audit.emitter
			await emitter?.({
				name: 'authz.denied',
				severity: 'warn',
				route: event.url.pathname,
				method: event.request.method,
				status: 403,
				message: 'Missing required auth role',
				userId: user.id,
				details: {
					requiredAuthRoles: required,
					actorAuthRoles: authRoles
				},
				timestamp: new Date().toISOString()
			})
			error(403, 'Forbidden')
		}
		return user
	}

	private resolveTarget(input: {
		event: RequestEventLike
		segments: string[]
		method: HandlerMethod
	}): HandlerTarget | null {
		const { event, segments, method } = input
		const handlers = this.core.handlers
		if (
			segments.length === 2 &&
			segments[0] === AUTH_ROUTE_PATHS.oauthSignIn.slice(1) &&
			method === 'GET'
		) {
			const provider = segments[1]
			if (!provider || !handlers.login) return null
			event.params['provider'] = provider
			event.params['intent'] = 'sign-in'
			return { method: 'GET', handler: handlers.login }
		}
		if (
			segments.length === 2 &&
			(segments[0] === AUTH_ROUTE_PATHS.oauthLink.slice(1) ||
				segments[0] === AUTH_ROUTE_PATHS.oauthReauthenticate.slice(1)) &&
			method === 'GET'
		) {
			const provider = segments[1]
			if (!provider || !handlers.login) return null
			event.params['provider'] = provider
			event.params['intent'] =
				segments[0] === AUTH_ROUTE_PATHS.oauthLink.slice(1) ? 'link' : 'reauth'
			return { method: 'GET', handler: handlers.login }
		}
		if (
			segments.length === 2 &&
			segments[0] === AUTH_ROUTE_PATHS.oauthCallback.slice(1) &&
			(method === 'GET' || method === 'POST')
		) {
			const provider = segments[1]
			if (!provider || !handlers.callback) return null
			event.params['provider'] = provider
			return { method, handler: handlers.callback }
		}
		if (segments.length === 1 && segments[0] === AUTH_ROUTE_PATHS.signOut.slice(1)) {
			return { method: 'POST', handler: handlers.logout }
		}
		if (matchesAuthRoute(segments, AUTH_ROUTE_PATHS.magicLink)) {
			if (!handlers.magicLink) return null
			return { method: 'POST', handler: handlers.magicLink.request }
		}
		if (matchesAuthRoute(segments, AUTH_ROUTE_PATHS.magicLinkVerify)) {
			if (!handlers.magicLink) return null
			return { method, handler: handlers.magicLink.verify }
		}
		if (matchesAuthRoute(segments, AUTH_ROUTE_PATHS.passkeyRegisterOptions)) {
			if (!handlers.webauthn) return null
			return { method: 'POST', handler: handlers.webauthn.registerOptions }
		}
		if (matchesAuthRoute(segments, AUTH_ROUTE_PATHS.passkeyRegisterVerify)) {
			if (!handlers.webauthn) return null
			return { method: 'POST', handler: handlers.webauthn.registerVerify }
		}
		if (matchesAuthRoute(segments, AUTH_ROUTE_PATHS.passkeyLoginOptions)) {
			if (!handlers.webauthn) return null
			return { method: 'POST', handler: handlers.webauthn.loginOptions }
		}
		if (matchesAuthRoute(segments, AUTH_ROUTE_PATHS.passkeyLoginVerify)) {
			if (!handlers.webauthn) return null
			return { method: 'POST', handler: handlers.webauthn.loginVerify }
		}
		if (matchesAuthRoute(segments, AUTH_ROUTE_PATHS.passkeyCredentials)) {
			if (!handlers.webauthn) return null
			return method === 'GET'
				? { method: 'GET', handler: handlers.webauthn.listCredentials }
				: { method: 'POST', handler: handlers.webauthn.removeCredential }
		}
		if (matchesAuthRoute(segments, AUTH_ROUTE_PATHS.passkeyStepUpOptions)) {
			if (!handlers.webauthn) return null
			return { method: 'POST', handler: handlers.webauthn.stepUpOptions }
		}
		if (matchesAuthRoute(segments, AUTH_ROUTE_PATHS.passkeyStepUpVerify)) {
			if (!handlers.webauthn) return null
			return { method: 'POST', handler: handlers.webauthn.stepUpVerify }
		}
		if (matchesAuthRoute(segments, AUTH_ROUTE_PATHS.mfaStatus)) {
			if (!handlers.mfa) return null
			return { method: 'GET', handler: handlers.mfa.status }
		}
		if (matchesAuthRoute(segments, AUTH_ROUTE_PATHS.mfaEnroll)) {
			if (!handlers.mfa) return null
			return { method: 'POST', handler: handlers.mfa.enroll }
		}
		if (matchesAuthRoute(segments, AUTH_ROUTE_PATHS.mfaVerify)) {
			if (!handlers.mfa) return null
			return { method: 'POST', handler: handlers.mfa.verify }
		}
		if (matchesAuthRoute(segments, AUTH_ROUTE_PATHS.mfaDisable)) {
			if (!handlers.mfa) return null
			return { method: 'POST', handler: handlers.mfa.disable }
		}
		if (matchesAuthRoute(segments, AUTH_ROUTE_PATHS.mfaBackupCode)) {
			if (!handlers.mfa) return null
			return { method: 'POST', handler: handlers.mfa.backupCode }
		}
		if (matchesAuthRoute(segments, AUTH_ROUTE_PATHS.mfaStepUp)) {
			if (!handlers.mfa) return null
			return { method: 'POST', handler: handlers.mfa.stepUp }
		}
		if (matchesAuthRoute(segments, AUTH_ROUTE_PATHS.sessions)) {
			if (!handlers.sessions) return null
			return method === 'GET'
				? { method: 'GET', handler: handlers.sessions.list }
				: { method: 'POST', handler: handlers.sessions.revoke }
		}
		if (matchesAuthRoute(segments, AUTH_ROUTE_PATHS.oauthIdentities)) {
			if (!handlers.oauth) return null
			return { method: 'GET', handler: handlers.oauth.identities }
		}
		if (matchesAuthRoute(segments, AUTH_ROUTE_PATHS.oauthUnlink)) {
			if (!handlers.oauth) return null
			return { method: 'POST', handler: handlers.oauth.unlink }
		}
		return null
	}
}
