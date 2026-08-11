import { describe, expect, it, vi } from 'vitest'

import { createMagicLinkRequestHandler } from '../../src/handlers/magicLinkRequest.ts'
import type { RequestEventLike } from '../../src/types/auth.ts'
import {
	createMagicLinkAdapter,
	createMagicLinkEvent,
	createTestMagicLinkRequestHandler,
	MAGIC_LINK_BASE_URL
} from './_magicLinkTestContext.ts'

describe('magic link requests', () => {
	it('does not send email when user is missing and signup disabled', async () => {
		const magicLinkAdapter = createMagicLinkAdapter()
		const sendEmail = vi.fn()
		const handler = createTestMagicLinkRequestHandler({
			magicLinkAdapter,
			sendEmail,
			allowSignup: false
		})

		const response = await handler(
			createMagicLinkEvent({ body: { email: 'missing@example.com' } }) as RequestEventLike
		)
		expect(await response.json()).toMatchObject({ ok: true })
		expect(sendEmail).not.toHaveBeenCalled()
		expect(magicLinkAdapter._tokens.size).toBe(0)
	})

	it('deletes a newly issued token when delivery fails', async () => {
		const magicLinkAdapter = createMagicLinkAdapter()
		const handler = createTestMagicLinkRequestHandler({
			magicLinkAdapter,
			userAdapter: {
				getUserByEmail: vi.fn(async (email) => ({ id: 'u1', email }))
			},
			sendEmail: vi.fn(async () => {
				throw new Error('delivery failed')
			})
		})

		await expect(
			handler(createMagicLinkEvent({ body: { email: 'u1@example.com' } }) as RequestEventLike)
		).rejects.toThrow('delivery failed')
		expect(magicLinkAdapter._tokens.size).toBe(0)
	})

	it('requires a canonical HTTPS origin and sufficiently strong OTP pepper', () => {
		const base = { magicLinkAdapter: createMagicLinkAdapter(), sendEmail: vi.fn() }
		expect(() =>
			createMagicLinkRequestHandler({ ...base, baseUrl: 'http://example.test' })
		).toThrow('HTTPS origin')
		expect(() => createMagicLinkRequestHandler({ ...base, baseUrl: MAGIC_LINK_BASE_URL })).toThrow(
			'requires otpPepper'
		)
		expect(() =>
			createMagicLinkRequestHandler({
				...base,
				baseUrl: MAGIC_LINK_BASE_URL,
				otpPepper: 'too-short'
			})
		).toThrow('at least 32 bytes')
	})
})
