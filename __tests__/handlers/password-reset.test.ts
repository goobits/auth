import { describe, it, expect, vi } from 'vitest'
import { createPasswordResetRequestHandler, createPasswordResetConfirmHandler } from '../../src/handlers/password-reset.ts'

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

	it('rejects invalid or expired reset token', async () => {
		const handler = createPasswordResetConfirmHandler({
			credentialsProvider: { updatePassword: vi.fn() },
			userAdapter: {},
			verificationTokenAdapter: {
				findByToken: vi.fn().mockResolvedValue(null),
				deleteById: vi.fn(),
				deleteByUserAndType: vi.fn()
			}
		})

		const result = await handler(createEventWithForm({ token: 'bad', password: 'newpass' }))
		expect(result.success).toBe(false)
		expect(result.error).toMatch(/Invalid or expired/) 
	})

	it('resets password on valid token', async () => {
		const credentialsProvider = { updatePassword: vi.fn() }
		const verificationTokenAdapter = {
			findByToken: vi.fn().mockResolvedValue({
				token: { id: 't1', expiresAt: new Date(Date.now() + 10000) },
				user: { id: 'u1' }
			}),
			deleteById: vi.fn(),
			deleteByUserAndType: vi.fn()
		}

		const handler = createPasswordResetConfirmHandler({
			credentialsProvider,
			userAdapter: {},
			verificationTokenAdapter,
			redirectTo: '/sign-in'
		})

		const result = await handler(createEventWithForm({ token: 'good', password: 'newpass' }))
		expect(result.success).toBe(true)
		expect(credentialsProvider.updatePassword).toHaveBeenCalledWith({
			userId: 'u1',
			newPassword: 'newpass',
			userAdapter: {}
		})
	})
})
