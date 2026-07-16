import type { Logger } from '@goobits/security/logger'
import {
	createRateLimiter,
	type RateLimiter,
	type RateLimitStore,
	type RateLimitWindow
} from '@goobits/security/rate-limit'

/** Authentication flows with package-owned abuse-control policy. */
export type AuthRateLimitFlow = 'default' | 'login' | 'registration' | 'password-reset'

/** Shared options accepted by authentication rate-limiter factories. */
export interface AuthRateLimitConfig {
	store?: RateLimitStore
	logger?: Logger
	keyPrefix?: string
}

/** Canonical multi-window policies used by managed and standalone auth flows. */
export const AUTH_RATE_LIMIT_WINDOWS = {
	default: [{ name: 'default:burst', windowMs: 60_000, maxEvents: 20 }],
	login: [
		{ name: 'login:burst', windowMs: 60_000, maxEvents: 5 },
		{ name: 'login:15-min', windowMs: 15 * 60_000, maxEvents: 15 }
	],
	registration: [
		{ name: 'registration:10-min', windowMs: 10 * 60_000, maxEvents: 3 },
		{ name: 'registration:hour', windowMs: 60 * 60_000, maxEvents: 5 }
	],
	'password-reset': [
		{ name: 'password-reset:15-min', windowMs: 15 * 60_000, maxEvents: 3 },
		{ name: 'password-reset:hour', windowMs: 60 * 60_000, maxEvents: 5 }
	]
} as const satisfies Record<AuthRateLimitFlow, ReadonlyArray<RateLimitWindow>>

/** Returns a defensive copy of a canonical auth rate-limit policy. */
export function getAuthRateLimitWindows(flow: AuthRateLimitFlow): RateLimitWindow[] {
	return AUTH_RATE_LIMIT_WINDOWS[flow].map((window) => ({ ...window }))
}

/** Creates a limiter for a named authentication flow. */
export function createAuthRateLimiter(
	flow: AuthRateLimitFlow,
	config: AuthRateLimitConfig = {}
): RateLimiter {
	return createRateLimiter({
		windows: getAuthRateLimitWindows(flow),
		keyPrefix: config.keyPrefix ?? `auth:${flow}`,
		...(config.store ? { store: config.store } : {}),
		...(config.logger ? { logger: config.logger } : {})
	})
}

/** Login attempts: 5/minute and 15/15 minutes per identifier. */
export function createLoginRateLimiter(config?: AuthRateLimitConfig): RateLimiter {
	return createAuthRateLimiter('login', config)
}

/** Registrations: 3/10 minutes and 5/hour per identifier. */
export function createRegistrationRateLimiter(config?: AuthRateLimitConfig): RateLimiter {
	return createAuthRateLimiter('registration', config)
}

/** Password-reset requests: 3/15 minutes and 5/hour per identifier. */
export function createPasswordResetRateLimiter(config?: AuthRateLimitConfig): RateLimiter {
	return createAuthRateLimiter('password-reset', config)
}
