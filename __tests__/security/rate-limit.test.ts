import { describe, it, expect } from 'vitest'
import { createRateLimiter, MemoryRateLimitStore } from '../../src/security/rate-limit.ts'

describe('rate limiter', () => {
	it('blocks after max attempts', async () => {
		const store = new MemoryRateLimitStore()
		const check = createRateLimiter({ store, windowMs: 1000, max: 2 })
		let res = await check('ip')
		expect(res.allowed).toBe(true)
		res = await check('ip')
		expect(res.allowed).toBe(true)
		res = await check('ip')
		expect(res.allowed).toBe(false)
	})
})
