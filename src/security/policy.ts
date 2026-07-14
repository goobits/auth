import { isHttpError, isRedirect, type RequestHandler } from '@sveltejs/kit'
import { createRateLimiter, type RateLimitStore } from '@goobits/security/rate-limit'
import type { RequestEventLike, TrustedProxyHeader } from '../types/auth.ts'
import { validateCsrfRequest, type CsrfStore } from './csrf.ts'
import { type AuthEventEmitter, createAuthEvent } from './events.ts'

type PolicyMode = 'required' | 'optional' | 'off'

export type SecurityRouteId =
	| 'oauth.login'
	| 'oauth.callback'
	| 'auth.logout'
	| 'magic.request'
	| 'magic.verify'
	| 'webauthn.register.options'
	| 'webauthn.register.verify'
	| 'webauthn.login.options'
	| 'webauthn.login.verify'
	| 'mfa.status'
	| 'mfa.enroll'
	| 'mfa.verify'
	| 'mfa.disable'
	| 'mfa.backup_code'
	| 'sessions.list'
	| 'sessions.revoke'

export type SecurityRoutePolicy = {
	csrf?: PolicyMode;
	rateLimit?: PolicyMode;
	audit?: PolicyMode;
}

export type SecurityPolicySettings = {
	csrf: {
		mode: PolicyMode;
		cookieName: string;
		headerName: string;
		checkExpiry: boolean;
		httpOnly?: boolean;
		store?: CsrfStore;
	};
	rateLimit: {
		mode: PolicyMode;
		max: number;
		windowMs: number;
		keyPrefix: string;
		trustProxyHeader: boolean;
		trustedProxyHeaders: readonly TrustedProxyHeader[];
		store?: RateLimitStore;
	};
	audit: {
		mode: PolicyMode;
		emitter?: AuthEventEmitter;
	};
	routes: Partial<Record<SecurityRouteId, SecurityRoutePolicy>>;
}

type ApplyPolicyInput = {
	handler: RequestHandler;
	routeId: SecurityRouteId;
	settings: SecurityPolicySettings;
}

function jsonError(status: number, message: string): Response {
	return new Response(JSON.stringify({ ok: false, error: message }), {
		status,
		headers: { 'content-type': 'application/json' }
	})
}

function getFirstHeaderIp(value: string | null): string | null {
	const firstIp = value?.split(',')[0]?.trim()
	return firstIp || null
}

function getClientIp(
	event: RequestEventLike,
	trustedProxyHeaders: readonly TrustedProxyHeader[]
): string {
	for (const header of trustedProxyHeaders) {
		if (header === 'cf-connecting-ip') {
			const cloudflareIp = event.request.headers.get('cf-connecting-ip')?.trim()
			if (cloudflareIp) return cloudflareIp
		}
		if (header === 'x-forwarded-for') {
			const forwardedIp = getFirstHeaderIp(event.request.headers.get('x-forwarded-for'))
			if (forwardedIp) return forwardedIp
		}
	}
	if (event.getClientAddress) return event.getClientAddress()
	return 'unknown'
}

/** Processes security policy for auth security checks. */
export function applySecurityPolicy({
	handler,
	routeId,
	settings
}: ApplyPolicyInput) {
	const limiter = createRateLimiter({
		windows: [
			{
				name: routeId,
				windowMs: settings.rateLimit.windowMs,
				maxEvents: settings.rateLimit.max
			}
		],
		keyPrefix: settings.rateLimit.keyPrefix,
		...(settings.rateLimit.store ? { store: settings.rateLimit.store } : {})
	})

	return async(event: RequestEventLike): Promise<Response> => {
		const method = event.request.method.toUpperCase()
		const routePolicy = settings.routes[routeId] ?? {}
		const csrfMode = routePolicy.csrf ?? settings.csrf.mode
		const rateMode = routePolicy.rateLimit ?? settings.rateLimit.mode
		const auditMode = routePolicy.audit ?? settings.audit.mode
		const ip = getClientIp(event, settings.rateLimit.trustedProxyHeaders)

		const emit = async(
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

		if (rateMode !== 'off') {
			const key = `${ routeId }:${ ip }`
			const result = await limiter.check(key)
			if (!result.allowed) {
				await emit('auth.rate_limited', 'warn', 429, 'Too many requests')
				return jsonError(429, 'Too many requests')
			}
		}

		const isStateChanging =
			method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE'
		if (isStateChanging && csrfMode === 'required') {
			const valid = await validateCsrfRequest({
				request: event.request,
				cookies: event.cookies,
				headerName: settings.csrf.headerName,
				cookieName: settings.csrf.cookieName,
				checkExpiry: settings.csrf.checkExpiry,
				...(settings.csrf.store ? { store: settings.csrf.store } : {})
			})
			if (!valid) {
				await emit('auth.csrf_failed', 'warn', 403, 'Invalid CSRF token')
				return jsonError(403, 'Invalid CSRF token')
			}
		}

		await emit('auth.request', 'info')
		try {
			const response = await handler(event as Parameters<RequestHandler>[0])
			await emit(
				response.status >= 400 ? 'auth.failure' : 'auth.success',
				response.status >= 400 ? 'warn' : 'info',
				response.status
			)
			return response
		} catch(error) {
			if (isRedirect(error)) {
				await emit('auth.success', 'info', error.status)
				throw error
			}

			const status = isHttpError(error) ? error.status : 500
			const severity = status >= 500 ? 'error' : 'warn'
			const message = error instanceof Error ? error.message : 'Request failed'
			await emit('auth.failure', severity, status, message)
			throw error
		}
	}
}
