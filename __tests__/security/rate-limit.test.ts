import { describe, expect, it } from 'vitest'

import { createRateLimiter, MemoryRateLimitStore } from '../../src/security/rate-limit.ts'

describe('rate limiter', () => {
	it('blocks after max attempts', async() => {
		const store = new MemoryRateLimitStore()
		const check = createRateLimiter({ store, windowMs: 1000, max: 2 })
		let res = await check('ip')
		expect(res.allowed).toBe(true)
		res = await check('ip')
		expect(res.allowed).toBe(true)
		res = await check('ip')
		expect(res.allowed).toBe(false)
	})

	it('supports deterministic clocks and clearing memory stores', async() => {
		let timestamp = Date.now()
		const store = new MemoryRateLimitStore()
		const check = createRateLimiter({
			max: 1,
			now: () => timestamp,
			store,
			windowMs: 1000
		})

		expect((await check('ip')).allowed).toBe(true)
		expect((await check('ip')).allowed).toBe(false)
		timestamp += 1_001
		expect((await check('ip')).allowed).toBe(true)
		store.clear()
		expect((await check('ip')).allowed).toBe(true)
	})
})
