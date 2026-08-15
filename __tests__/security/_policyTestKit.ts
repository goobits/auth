import { vi } from 'vitest'
import type { RequestEventLike } from '../../src/types/auth.ts'
import { createCookies, createRequestEvent } from '../testKit.ts'

const CSRF_SECRET = 'auth-test-csrf-secret-that-is-at-least-32-bytes'

export function csrfSettings(mode: 'required' | 'optional' | 'off') {
	return {
		mode,
		...(mode === 'off' ? {} : { secret: CSRF_SECRET }),
		cookieName: 'csrf-token',
		headerName: 'x-csrf-token',
		checkExpiry: false,
		httpOnly: false,
		secureCookies: false
	}
}

const requestOriginOff = { mode: 'off' as const, allowedOrigins: [] }

export function createPolicySettings({
	csrfMode = 'off',
	rateLimitMode = 'off',
	keyPrefix = 'test',
	trustedProxyHeaders = [],
	forwardedForTrustedProxyHops
}: {
	csrfMode?: 'required' | 'optional' | 'off'
	rateLimitMode?: 'required' | 'optional' | 'off'
	keyPrefix?: string
	trustedProxyHeaders?: Array<'cf-connecting-ip' | 'x-forwarded-for'>
	forwardedForTrustedProxyHops?: number
} = {}) {
	return {
		requestOrigin: requestOriginOff,
		csrf: csrfSettings(csrfMode),
		rateLimit: {
			mode: rateLimitMode,
			windows: [
				{ name: 'test', maxEvents: rateLimitMode === 'required' ? 1 : 10, windowMs: 60_000 }
			],
			keyPrefix,
			trustedProxyHeaders,
			...(forwardedForTrustedProxyHops ? { forwardedForTrustedProxyHops } : {})
		},
		audit: { mode: 'off' as const },
		routes: {}
	}
}

export function createEvent({
	method = 'POST',
	headers = {},
	cookies = createCookies(),
	clientAddress = '127.0.0.1'
}: {
	method?: string
	headers?: Record<string, string>
	cookies?: ReturnType<typeof createCookies>
	clientAddress?: string
} = {}): RequestEventLike {
	return {
		...createRequestEvent({
			url: 'http://localhost/auth/test',
			method,
			headers,
			cookies,
			locals: { user: null, session: null }
		}),
		getClientAddress: () => clientAddress
	}
}

export function createAuditSettings(emitter: ReturnType<typeof vi.fn>) {
	return {
		requestOrigin: requestOriginOff,
		csrf: csrfSettings('off'),
		rateLimit: {
			mode: 'off' as const,
			windows: [{ name: 'audit', maxEvents: 10, windowMs: 60_000 }],
			keyPrefix: 'test-audit',
			trustedProxyHeaders: []
		},
		audit: { mode: 'required' as const, emitter },
		routes: {}
	}
}
