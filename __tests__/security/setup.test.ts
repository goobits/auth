import { MemoryCsrfStore } from '@goobits/security/csrf'
import { MemoryRateLimitStore } from '@goobits/security/rate-limit'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { resolveSecurity } from '../../src/createAuth/securitySetup.ts'
import { createSecurityAlertObserver } from '../../src/security/alerts.ts'
import type { AuthConfig, AuthSecurityConfig, SecurityProfile } from '../../src/types/auth.ts'

const CSRF_SECRET = 'auth-test-csrf-secret-that-is-at-least-32-bytes'

function config(
	profile: SecurityProfile = 'secure',
	security: AuthSecurityConfig = {}
): AuthConfig {
	return {
		adapters: { session: {} as never },
		profile,
		security: {
			...security,
			csrf: { secret: CSRF_SECRET, ...security.csrf }
		}
	}
}

afterEach(() => {
	vi.unstubAllEnvs()
})

describe('auth security profiles', () => {
	it('enables built-in CSRF and rate limiting for the secure profile', () => {
		const resolved = resolveSecurity(config())

		expect(resolved.requestOrigin.mode).toBe('required')
		expect(resolved.csrf.mode).toBe('required')
		expect(resolved.csrf.secret).toBe(CSRF_SECRET)
		expect(resolved.rateLimit.mode).toBe('required')
		expect(resolved.rateLimit.windows).toEqual([
			{ name: 'login:burst', windowMs: 60_000, maxEvents: 5 },
			{ name: 'login:15-min', windowMs: 15 * 60_000, maxEvents: 15 }
		])
		expect(resolved.routes['magic.request']?.rateLimitWindows).toEqual([
			{ name: 'password-reset:15-min', windowMs: 15 * 60_000, maxEvents: 3 },
			{ name: 'password-reset:hour', windowMs: 60 * 60_000, maxEvents: 5 }
		])
		expect(resolved.routes['webauthn.register.options']?.rateLimitWindows).toEqual([
			{ name: 'registration:10-min', windowMs: 10 * 60_000, maxEvents: 3 },
			{ name: 'registration:hour', windowMs: 60 * 60_000, maxEvents: 5 }
		])
		expect(resolved.routes['oauth.identities.list']?.csrf).toBe('off')
		expect(resolved.routes['oauth.identity.unlink']?.csrf).toBe('required')
	})

	it('keeps request-origin verification required when secure CSRF is disabled', () => {
		const validate = async () => true
		const resolved = resolveSecurity(
			config('secure', {
				csrf: { mode: 'off' },
				requestOrigin: { mode: 'required', validate }
			})
		)
		expect(resolved.csrf.mode).toBe('off')
		expect(resolved.requestOrigin).toMatchObject({ mode: 'required', validate })
	})

	it('does not allow the strict profile to delegate its CSRF boundary', () => {
		expect(() =>
			resolveSecurity(
				config('strict', { csrf: { mode: 'off' } })
			)
		).toThrow('strict auth profile requires built-in CSRF protection')
	})

	it('requires a CSRF secret and rejects disabled custom origin validation', () => {
		expect(() =>
			resolveSecurity({ adapters: { session: {} as never }, profile: 'secure' })
		).toThrow('security.csrf.secret')
		expect(() =>
			resolveSecurity(
				config('secure', {
					requestOrigin: { mode: 'off', validate: async () => true }
				})
			)
		).toThrow('requestOrigin.validate')
	})

	it('treats unknown runtime modes as production-safe', () => {
		vi.stubEnv('NODE_ENV', 'staging')
		expect(() => resolveSecurity(config())).toThrow('shared rate-limit store in production')
	})

	it('does not allow secure profiles to disable rate limiting', () => {
		expect(() => resolveSecurity(config('secure', { rateLimit: { mode: 'off' } }))).toThrow(
			'secure auth profile requires rate limiting'
		)
	})

	it('requires explicit shared stores for production policy state', () => {
		vi.stubEnv('NODE_ENV', 'production')
		expect(() => resolveSecurity(config())).toThrow('shared rate-limit store in production')

		const rateLimitStore = new MemoryRateLimitStore()
		const csrfStore = new MemoryCsrfStore()
		const emitter = vi.fn()
		expect(() =>
			resolveSecurity(config('secure', { rateLimit: { store: rateLimitStore } }))
		).toThrow('explicit audit emitter')
		expect(() =>
			resolveSecurity(
				config('strict', {
					rateLimit: { store: rateLimitStore },
					audit: { emitter }
				})
			)
		).toThrow('shared CSRF store in production')

		const resolved = resolveSecurity(
			config('strict', {
				csrf: { store: csrfStore },
				rateLimit: { store: rateLimitStore },
				audit: { emitter }
			})
		)
		expect(resolved.csrf.store).toBe(csrfStore)
		expect(resolved.rateLimit.store).toBe(rateLimitStore)
	})

	it('shares alert thresholds across auth instances through the configured store', async () => {
		const store = new MemoryRateLimitStore()
		const onAlert = vi.fn()
		const security: AuthSecurityConfig = {
			rateLimit: { store },
			alerts: {
				store,
				keyPrefix: 'test-auth-alert',
				onAlert
			}
		}
		const first = resolveSecurity(config('secure', security))
		const second = resolveSecurity(config('secure', security))
		const event = {
			name: 'auth.failure' as const,
			severity: 'warn' as const,
			timestamp: new Date().toISOString(),
			route: 'credentials.login',
			method: 'POST'
		}

		for (let attempt = 0; attempt < 5; attempt += 1) {
			await first.audit.emitter?.(event)
		}
		expect(onAlert).not.toHaveBeenCalled()

		for (let attempt = 0; attempt < 5; attempt += 1) {
			await second.audit.emitter?.(event)
		}
		expect(onAlert).toHaveBeenCalledOnce()
		expect(onAlert).toHaveBeenCalledWith(
			expect.objectContaining({ eventName: 'auth.failure', count: 10 })
		)
	})

	it('claims one alert even when concurrent storage jumps past the exact threshold', async () => {
		const timestampsByKey = new Map<string, number[]>()
		const store = {
			async getEntry(key: string) {
				const timestamps = timestampsByKey.get(key)
				return timestamps ? { timestamps } : null
			},
			async incrementEntry(key: string, now: number) {
				const timestamps = timestampsByKey.get(key) ?? []
				if (!key.includes(':notification:') && timestamps.length === 0) {
					for (let index = 0; index < 10; index += 1) timestamps.push(now)
				}
				timestamps.push(now)
				timestampsByKey.set(key, timestamps)
				return { timestamps }
			},
			async deleteEntry(key: string) {
				timestampsByKey.delete(key)
			}
		}
		const onAlert = vi.fn()
		const observer = createSecurityAlertObserver({
			store,
			onAlert,
			rules: [{ eventName: 'auth.failure', max: 10, windowMs: 60_000, severity: 'warning' }]
		})
		const event = {
			name: 'auth.failure' as const,
			severity: 'warn' as const,
			timestamp: new Date().toISOString(),
			route: 'credentials.login',
			method: 'POST'
		}

		await observer(event)
		await observer(event)

		expect(onAlert).toHaveBeenCalledOnce()
		expect(onAlert).toHaveBeenCalledWith(expect.objectContaining({ count: 11 }))
	})
})
