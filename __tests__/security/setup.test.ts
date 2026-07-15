import { MemoryCsrfStore } from '@goobits/security/csrf'
import { MemoryRateLimitStore } from '@goobits/security/rate-limit'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { resolveSecurity } from '../../src/createAuth/securitySetup.ts'
import type { AuthConfig, AuthSecurityConfig, SecurityProfile } from '../../src/types/auth.ts'

function config(
	profile: SecurityProfile = 'secure',
	security: AuthSecurityConfig = {}
): AuthConfig {
	return {
		adapters: { session: {} as never },
		profile,
		security
	}
}

afterEach(() => {
	vi.unstubAllEnvs()
})

describe('auth security profiles', () => {
	it('enables built-in CSRF and rate limiting for the secure profile', () => {
		const resolved = resolveSecurity(config())

		expect(resolved.csrf.mode).toBe('required')
		expect(resolved.csrf.externalBoundary).toBe(false)
		expect(resolved.rateLimit.mode).toBe('required')
	})

	it('requires an explicit external boundary when secure CSRF is disabled', () => {
		expect(() => resolveSecurity(config('secure', { csrf: { mode: 'off' } }))).toThrow(
			'requires CSRF protection'
		)

		const resolved = resolveSecurity(
			config('secure', { csrf: { mode: 'off', externalBoundary: true } })
		)
		expect(resolved.csrf).toMatchObject({ mode: 'off', externalBoundary: true })
	})

	it('does not allow the strict profile to delegate its CSRF boundary', () => {
		expect(() =>
			resolveSecurity(config('strict', { csrf: { mode: 'off', externalBoundary: true } }))
		).toThrow('strict auth profile requires built-in CSRF protection')
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
		expect(() =>
			resolveSecurity(config('strict', { rateLimit: { store: rateLimitStore } }))
		).toThrow('shared CSRF store in production')

		const resolved = resolveSecurity(
			config('strict', {
				csrf: { store: csrfStore },
				rateLimit: { store: rateLimitStore }
			})
		)
		expect(resolved.csrf.store).toBe(csrfStore)
		expect(resolved.rateLimit.store).toBe(rateLimitStore)
	})
})
