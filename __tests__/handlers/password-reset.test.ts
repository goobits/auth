import { describe, expect, it, vi } from 'vitest'

import {
	createPasswordResetConfirmHandler,
	createPasswordResetRequestHandler
} from '../../src/handlers/passwordReset.ts'
import { hashVerificationToken } from '../../src/verification/index.ts'

function createEventWithForm(data: Record<string, string>) {
	return {
		request: new Request('http://localhost/reset', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams(data)
		}),
		locals: {},
		getClientAddress: () => '127.0.0.1'
	}
}

describe('password reset handlers', () => {
	it('blocks request on invalid CSRF', async () => {
		const handler = createPasswordResetRequestHandler({
			userAdapter: { getUserByEmail: vi.fn() },
			verificationTokenAdapter: {},
			sendPasswordResetEmail: vi.fn(),
			csrf: { validate: vi.fn().mockResolvedValue(false), errorMessage: 'nope' }
		})

		const result = await handler(createEventWithForm({ email: 'a@b.com' }))
		expect(result.success).toBe(false)
		expect(result.error).toBe('nope')
	})

	it('does not reveal if user is missing', async () => {
		const sendPasswordResetEmail = vi.fn()
		const handler = createPasswordResetRequestHandler({
			userAdapter: { getUserByEmail: vi.fn().mockResolvedValue(null) },
			verificationTokenAdapter: {},
			sendPasswordResetEmail
		})

		const result = await handler(createEventWithForm({ email: 'missing@b.com' }))
		expect(result.success).toBe(true)
		expect(sendPasswordResetEmail).not.toHaveBeenCalled()
	})

	it('supports an application identity resolver without changing the public response', async () => {
		const resolveUser = vi.fn().mockResolvedValue(null)
		const handler = createPasswordResetRequestHandler({
			userAdapter: { getUserByEmail: vi.fn() },
			verificationTokenAdapter: {},
			sendPasswordResetEmail: vi.fn(),
			resolveUser
		})

		const result = await handler(
			createEventWithForm({
				email: 'legacy@example.com',
				identifier: 'legacy-user'
			})
		)

		expect(result.success).toBe(true)
		expect(resolveUser).toHaveBeenCalledWith(
			expect.objectContaining({
				email: 'legacy@example.com',
				identifier: 'legacy-user'
			})
		)
	})

	it('rejects invalid or expired reset token', async () => {
		const handler = createPasswordResetConfirmHandler({
			credentialsProvider: { createPasswordHash: vi.fn(async () => 'encoded-hash') },
			completePasswordReset: vi.fn().mockResolvedValue(null)
		})

		const result = await handler(createEventWithForm({ token: 'bad', password: 'newpass' }))
		expect(result.success).toBe(false)
		expect(result.error).toMatch(/Invalid or expired/)
	})

	it('delegates atomic completion with a validated password hash', async () => {
		const completePasswordReset = vi.fn().mockResolvedValue({ userId: 'u1' })
		const credentialsProvider = {
			createPasswordHash: vi.fn(async () => 'encoded-hash')
		}
		const handler = createPasswordResetConfirmHandler({
			credentialsProvider,
			completePasswordReset,
			redirectTo: '/sign-in'
		})

		const result = await handler(createEventWithForm({ token: 'good', password: 'newpass' }))

		expect(result.success).toBe(true)
		expect(completePasswordReset).toHaveBeenCalledWith({
			tokenHash: await hashVerificationToken('good'),
			passwordHash: 'encoded-hash'
		})
		expect(result).toMatchObject({ sessionsInvalidated: true, redirectTo: '/sign-in' })
	})

	it('never exposes storage errors in the public response', async () => {
		const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
		const handler = createPasswordResetConfirmHandler({
			credentialsProvider: { createPasswordHash: vi.fn(async () => 'encoded-hash') },
			completePasswordReset: vi.fn().mockRejectedValue(new Error('database secret detail')),
			logger
		})

		const result = await handler(createEventWithForm({ token: 'good', password: 'newpass' }))
		expect(result).toEqual({
			error: 'An error occurred while resetting password',
			success: false
		})
		expect(JSON.stringify(result)).not.toContain('database secret detail')
		expect(logger.error).toHaveBeenCalled()
		expect(JSON.stringify(logger.error.mock.calls)).not.toContain('database secret detail')
	})
})
