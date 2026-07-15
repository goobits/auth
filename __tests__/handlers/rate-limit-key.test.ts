import { describe, expect, it } from 'vitest'

import { resolveHandlerRateLimitKey } from '../../src/handlers/rateLimitKey.ts'
import { createRequestEvent } from '../testKit.ts'

describe('standalone handler rate-limit keys', () => {
	it('uses the platform client address and ignores request proxy headers', () => {
		const event = createRequestEvent({
			headers: { 'x-forwarded-for': '203.0.113.10' }
		})
		event.getClientAddress = () => '198.51.100.7'

		expect(resolveHandlerRateLimitKey(event)).toBe('198.51.100.7')
	})

	it('supports an application-owned key and otherwise fails closed to a shared bucket', () => {
		const event = createRequestEvent({
			headers: { 'x-forwarded-for': '203.0.113.10' }
		})

		expect(resolveHandlerRateLimitKey(event, { key: () => 'trusted-edge:203.0.113.10' })).toBe(
			'trusted-edge:203.0.113.10'
		)
		expect(resolveHandlerRateLimitKey(event)).toBe('unknown')
	})
})
