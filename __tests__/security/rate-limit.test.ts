import { describe, expect, it } from 'vitest'

import {
	AUTH_RATE_LIMIT_WINDOWS,
	createLoginRateLimiter,
	createPasswordResetRateLimiter,
	createRegistrationRateLimiter,
	getAuthRateLimitWindows
} from '../../src/security/rateLimit.ts'

describe('auth-owned rate-limit policies', () => {
	it('blocks login bursts after five attempts', async () => {
		const limiter = createLoginRateLimiter()
		for (let attempt = 0; attempt < 5; attempt += 1) {
			expect((await limiter.check('alice')).allowed).toBe(true)
		}
		expect((await limiter.check('alice')).allowed).toBe(false)
		expect((await limiter.check('bob')).allowed).toBe(true)
	})

	it('blocks registrations after three attempts in ten minutes', async () => {
		const limiter = createRegistrationRateLimiter()
		for (let attempt = 0; attempt < 3; attempt += 1) {
			expect((await limiter.check('192.0.2.1')).allowed).toBe(true)
		}
		expect((await limiter.check('192.0.2.1')).allowed).toBe(false)
	})

	it('blocks password reset requests after three attempts in fifteen minutes', async () => {
		const limiter = createPasswordResetRateLimiter()
		for (let attempt = 0; attempt < 3; attempt += 1) {
			expect((await limiter.check('member@example.test')).allowed).toBe(true)
		}
		expect((await limiter.check('member@example.test')).allowed).toBe(false)
	})

	it('returns defensive policy copies', () => {
		const windows = getAuthRateLimitWindows('login')
		windows[0]!.maxEvents = 999

		expect(AUTH_RATE_LIMIT_WINDOWS.login[0].maxEvents).toBe(5)
	})
})
