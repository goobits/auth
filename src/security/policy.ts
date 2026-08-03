import { isHttpError, isRedirect } from '@sveltejs/kit'
import {
	createRateLimiter,
	getClientIP,
	type RateLimitStore,
	type RateLimitWindow
} from '@goobits/security/rate-limit'
import type { Logger } from '@goobits/security/logger'
import type { CsrfTokenStore } from '@goobits/security/csrf'
import {
	createSvelteKitCsrf,
	type SvelteKitCsrf
} from '@goobits/security/csrf/sveltekit'
import { BodyTooLargeError } from '@goobits/security/request-body'
import { verifyRequestOrigin } from '@goobits/security/request-origin'
import type { AuthRequestHandler, RequestEventLike, TrustedProxyHeader } from '../types/auth.ts'
import { resolvePlatformClientAddress } from '../utils/clientAddress.ts'
import { type AuthEventEmitter, createAuthEvent } from './events.ts'

type PolicyMode = 'required' | 'optional' | 'off'

type SecurityRouteId =
	| 'oauth.login'
	| 'oauth.callback'
	| 'oauth.identities.list'
	| 'oauth.identity.unlink'
	| 'auth.logout'
	| 'magic.request'
	| 'magic.verify'
	| 'webauthn.register.options'
	| 'webauthn.register.verify'
	| 'webauthn.login.options'
	| 'webauthn.login.verify'
	| 'webauthn.credentials.list'
	| 'webauthn.credentials.remove'
	| 'webauthn.step_up.options'
	| 'webauthn.step_up.verify'
	| 'mfa.status'
	| 'mfa.enroll'
	| 'mfa.verify'
	| 'mfa.disable'
	| 'mfa.backup_code'
	| 'mfa.step_up'
	| 'sessions.list'
	| 'sessions.revoke'

type SecurityRoutePolicy = {
	requestOrigin?: PolicyMode
	csrf?: PolicyMode
	rateLimit?: PolicyMode
	rateLimitWindows?: readonly RateLimitWindow[]
	audit?: PolicyMode
}

export type SecurityPolicySettings = {
	requestOrigin: {
		mode: PolicyMode
		allowedOrigins: readonly string[]
		validate?: (event: RequestEventLike) => boolean | Promise<boolean>
	}
	csrf: {
		mode: PolicyMode
		secret?: string | Uint8Array
		cookieName: string
		headerName: string
		checkExpiry: boolean
		httpOnly: boolean
		secureCookies: boolean
		store?: CsrfTokenStore
	}
	rateLimit: {
		mode: PolicyMode
		windows: readonly RateLimitWindow[]
		keyPrefix: string
		trustedProxyHeaders: readonly TrustedProxyHeader[]
		forwardedForTrustedProxyHops?: number
		store?: RateLimitStore
		logger?: Logger
	}
	audit: {
		mode: PolicyMode
		emitter?: AuthEventEmitter
	}
	routes: Partial<Record<SecurityRouteId, SecurityRoutePolicy>>
}

/** Creates Auth's single canonical session-bound CSRF adapter configuration. */
export function createAuthCsrf(settings: SecurityPolicySettings): SvelteKitCsrf {
	const secret = settings.csrf.secret
	if (!secret) throw new Error('Auth CSRF protection requires security.csrf.secret')
	return createSvelteKitCsrf({
		secret,
		cookieName: settings.csrf.cookieName,
		headerName: settings.csrf.headerName,
		checkExpiry: settings.csrf.checkExpiry,
		trackExpiry: settings.csrf.checkExpiry,
		getSessionBinding: (event) =>
			(event as unknown as RequestEventLike).locals.session?.id ?? null,
		cookieOptions: {
			httpOnly: settings.csrf.httpOnly,
			secure: settings.csrf.secureCookies,
			sameSite: 'lax',
			path: '/',
			maxAge: 60 * 60
		},
		...(settings.csrf.store ? { tokenStore: settings.csrf.store } : {})
	})
}

type ApplyPolicyInput = {
	handler: AuthRequestHandler
	routeId: SecurityRouteId
	settings: SecurityPolicySettings
}

function jsonError(status: number, message: string, headers?: Record<string, string>): Response {
	return new Response(JSON.stringify({ ok: false, error: message }), {
		status,
		headers: { 'content-type': 'application/json', ...headers }
	})
}

function getClientIp(
	event: RequestEventLike,
	{
		trustedProxyHeaders,
		forwardedForTrustedProxyHops
	}: Pick<
		SecurityPolicySettings['rateLimit'],
		'trustedProxyHeaders' | 'forwardedForTrustedProxyHops'
	>
): string {
	const proxyIp = getClientIP(event.request, {
		trustHeaders: trustedProxyHeaders,
		...(forwardedForTrustedProxyHops !== undefined ? { forwardedForTrustedProxyHops } : {})
	})
	if (proxyIp !== 'unknown') return proxyIp
	return resolvePlatformClientAddress(event)
}

/** Processes security policy for auth security checks. */
export function applySecurityPolicy({ handler, routeId, settings }: ApplyPolicyInput) {
	const routePolicy = settings.routes[routeId] ?? {}
	const rateLimitWindows = routePolicy.rateLimitWindows ?? settings.rateLimit.windows
	const limiter = createRateLimiter({
		windows: rateLimitWindows.map((window) => ({
			...window,
			name: `${routeId}:${window.name}`
		})),
		keyPrefix: settings.rateLimit.keyPrefix,
		...(settings.rateLimit.logger ? { logger: settings.rateLimit.logger } : {}),
		...(settings.rateLimit.store ? { store: settings.rateLimit.store } : {})
	})
	const csrf = settings.csrf.mode === 'off' ? null : createAuthCsrf(settings)

	return async (event: RequestEventLike): Promise<Response> => {
		const method = event.request.method.toUpperCase()
		const requestOriginMode = routePolicy.requestOrigin ?? settings.requestOrigin.mode
		const csrfMode = routePolicy.csrf ?? settings.csrf.mode
		const rateMode = routePolicy.rateLimit ?? settings.rateLimit.mode
		const auditMode = routePolicy.audit ?? settings.audit.mode
		const ip = getClientIp(event, settings.rateLimit)

		const emit = async (
			name: Parameters<typeof createAuthEvent>[0]['name'],
			severity: Parameters<typeof createAuthEvent>[0]['severity'],
			status?: number,
			message?: string,
			details?: Record<string, unknown>
		) => {
			if (auditMode === 'off' || !settings.audit.emitter) return
			const payload = {
				name,
				severity,
				route: routeId,
				method,
				ip,
				...(status !== undefined ? { status } : {}),
				...(message !== undefined ? { message } : {}),
				...(event.locals.user?.id ? { userId: String(event.locals.user.id) } : { userId: null }),
				...(details !== undefined ? { details } : {})
			}
			await settings.audit.emitter(createAuthEvent(payload))
		}

		const isStateChanging =
			method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE'
		if (isStateChanging && requestOriginMode !== 'off') {
			const validOrigin = settings.requestOrigin.validate
				? await settings.requestOrigin.validate(event)
				: verifyRequestOrigin({
						request: event.request,
						requestUrl: event.url,
						allowedOrigins: settings.requestOrigin.allowedOrigins,
						allowMissingBrowserContext: requestOriginMode === 'optional'
					}).ok
			if (!validOrigin) {
				await emit('auth.csrf_failed', 'warn', 403, 'Invalid request origin', {
					boundary: 'request-origin'
				})
				return jsonError(403, 'Invalid request origin')
			}
		}

		if (rateMode !== 'off') {
			const key = `${routeId}:${ip}`
			const result = await limiter.check(key)
			if (!result.allowed) {
				await emit('auth.rate_limited', 'warn', 429, 'Too many requests')
				return jsonError(429, 'Too many requests', {
					'Retry-After': String(result.retryAfterSec)
				})
			}
		}

		const enforceCsrf =
			isStateChanging &&
			csrfMode !== 'off' &&
			(csrfMode === 'required' || Boolean(event.cookies.get(settings.csrf.cookieName)))
		if (enforceCsrf) {
			const valid = csrf ? await csrf.validate(event as never) : false
			if (!valid) {
				await emit('auth.csrf_failed', 'warn', 403, 'Invalid CSRF token')
				return jsonError(403, 'Invalid CSRF token')
			}
		}
		await emit('auth.request', 'info')
		try {
			const response = await handler(event)
			await emit(
				response.status >= 400 ? 'auth.failure' : 'auth.success',
				response.status >= 400 ? 'warn' : 'info',
				response.status
			)
			return response
		} catch (error) {
			if (isRedirect(error)) {
				await emit('auth.success', 'info', error.status)
				throw error
			}
			if (error instanceof BodyTooLargeError) {
				await emit('auth.failure', 'warn', 413, 'Request body too large')
				return jsonError(413, 'Request body too large')
			}

			const status = isHttpError(error) ? error.status : 500
			const severity = status >= 500 ? 'error' : 'warn'
			const message = error instanceof Error ? error.message : 'Request failed'
			await emit('auth.failure', severity, status, message)
			throw error
		}
	}
}
