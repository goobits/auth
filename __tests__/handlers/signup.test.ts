import { describe, expect, it, vi } from 'vitest'

import { createSignupHandler } from '../../src/handlers/signup.ts'
import { captureRejected, createRequestEvent, getRedirectLocation } from '../testKit.ts'

describe('createSignupHandler', () => {
	it('rejects if email already exists', async () => {
		const userAdapter = { getUserByEmail: vi.fn().mockResolvedValue({ id: 'u1' }) }
		const credentialsProvider = { signUp: vi.fn() }
		const sessionAdapter = { createSession: vi.fn(), setSessionCookie: vi.fn() }
		const passwordCredentialAdapter = {}

		const handler = createSignupHandler({
			validateExternalSecurityBoundary: async () => true,
			credentialsProvider,
			passwordCredentialAdapter,
			userAdapter,
			sessionAdapter
		})
		const result = await handler(
			createRequestEvent({
				url: 'http://localhost/signup',
				method: 'POST',
				form: { email: 'a@b.com', password: 'pw', name: 'A' }
			})
		)

		expect(result.success).toBe(false)
		expect(credentialsProvider.signUp).not.toHaveBeenCalled()
	})

	it('continues signup if verification email fails', async () => {
		const userAdapter = {
			getUserByEmail: vi.fn().mockResolvedValue(null)
		}
		const passwordCredentialAdapter = {}
		const credentialsProvider = {
			signUp: vi.fn().mockResolvedValue({ id: 'u1', email: 'a@b.com' })
		}
		const sessionAdapter = {
			createSession: vi
				.fn()
				.mockResolvedValue({ id: 's1', expiresAt: new Date(Date.now() + 1000) }),
			setSessionCookie: vi.fn()
		}
		const verificationTokenAdapter = {
			deleteByUserAndType: vi.fn(),
			create: vi.fn(),
			replaceForUserAndType: vi.fn(),
			findByToken: vi.fn(),
			deleteById: vi.fn(),
			consumeByToken: vi.fn()
		}

		const handler = createSignupHandler({
			validateExternalSecurityBoundary: async () => true,
			credentialsProvider,
			passwordCredentialAdapter,
			userAdapter,
			sessionAdapter,
			verificationTokenAdapter,
			sendVerificationEmail: vi.fn().mockRejectedValue(new Error('smtp down')),
			redirectTo: '/welcome'
		})

		const error = await captureRejected<{ status?: number; headers?: Headers; location?: string }>(
			handler(
				createRequestEvent({
					url: 'http://localhost/signup',
					method: 'POST',
					form: { email: 'a@b.com', password: 'pw', name: 'A' }
				})
			)
		)
		expect(error.status).toBe(303)
		expect(getRedirectLocation(error)).toBe('/welcome')

		expect(verificationTokenAdapter.replaceForUserAndType).toHaveBeenCalledOnce()
		expect(sessionAdapter.setSessionCookie).not.toHaveBeenCalled()
	})
})
