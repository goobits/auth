import { describe, it, expect, vi } from 'vitest'
import { createSigninHandler } from '../../src/handlers/signin.ts'
import { captureRejected, createRequestEvent, getRedirectLocation } from '../test-kit.ts'

describe('createSigninHandler', () => {
	it('rejects invalid credentials without setting cookie', async () => {
		const credentialsProvider = { authenticate: vi.fn().mockResolvedValue({ user: null, valid: false }) }
		const sessionAdapter = { createSession: vi.fn(), setSessionCookie: vi.fn() }
		const userAdapter = {}

		const handler = createSigninHandler({ credentialsProvider, userAdapter, sessionAdapter })
		const result = await handler(
			createRequestEvent({
				url: 'http://localhost/signin',
				method: 'POST',
				form: { email: 'a@b.com', password: 'pw' }
			})
		)

		expect(result.success).toBe(false)
		expect(sessionAdapter.setSessionCookie).not.toHaveBeenCalled()
	})

	it('creates session and redirects on success', async () => {
		const credentialsProvider = { authenticate: vi.fn().mockResolvedValue({ user: { id: 'u1' }, valid: true }) }
		const sessionAdapter = {
			createSession: vi.fn().mockResolvedValue({ id: 's1', expiresAt: new Date(Date.now() + 1000) }),
			setSessionCookie: vi.fn()
		}

		const handler = createSigninHandler({
			credentialsProvider,
			userAdapter: {},
			sessionAdapter,
			redirectTo: '/dashboard'
		})

		const error = await captureRejected<{ status?: number; headers?: Headers; location?: string }>(
			handler(
				createRequestEvent({
					url: 'http://localhost/signin',
					method: 'POST',
					form: { email: 'a@b.com', password: 'pw' }
				})
			)
		)
		expect(error.status).toBe(303)
		expect(getRedirectLocation(error)).toBe('/dashboard')

		expect(sessionAdapter.createSession).toHaveBeenCalledWith(
			'u1',
			expect.objectContaining({ rememberMe: false })
		)
		expect(sessionAdapter.setSessionCookie).toHaveBeenCalled()
	})
})
