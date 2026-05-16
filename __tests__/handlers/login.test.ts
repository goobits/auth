import { describe, it, expect, vi } from 'vitest'
import { createLoginHandler } from '../../src/handlers/login.ts'
import type { OAuthProvider } from '../../src/providers/base.ts'
import { captureRejected, createRequestEvent, getRedirectLocation } from '../test-kit.ts'

function createProvider(createAuthorizationURL?: () => URL): OAuthProvider {
	return {
		createAuthorizationURL: createAuthorizationURL ?? (() => new URL('https://example.com/auth')),
		getUserProfile: vi.fn(async () => ({
			profile: { id: 'u1', email: 'u1@example.com' },
			tokens: { accessToken: 'token' }
		}))
	}
}

describe('createLoginHandler', () => {
	it('rejects unknown provider', async () => {
		const handler = createLoginHandler({ providers: {} })
		const response = await handler(createRequestEvent({ params: { provider: 'unknown' } }))
		expect(response.status).toBe(400)
	})

	it('redirects if already authenticated', async () => {
		const handler = createLoginHandler({
			providers: { google: { provider: createProvider(() => new URL('https://example.com')) } },
			redirectAfterLogin: '/home',
			isAuthenticated: () => true
		})

		const error = await captureRejected<{ status?: number }>(
			handler(createRequestEvent({ params: { provider: 'google' } }))
		)
		expect(error.status).toBe(302)
	})

	it('sets apple response_mode to form_post', async () => {
		const createAuthorizationURL = vi.fn(() => new URL('https://apple.example.com/authorize'))
		const handler = createLoginHandler({
			providers: {
				apple: { provider: createProvider(createAuthorizationURL), scopes: ['email'] }
			}
		})

		const error = await captureRejected<{ status?: number; headers?: Headers; location?: string }>(
			handler(createRequestEvent({ params: { provider: 'apple' } }))
		)
		const location = getRedirectLocation(error)
		expect(error.status).toBe(302)
		expect(location).toBeTruthy()
		if (!location) throw new Error('Missing redirect location')
		expect(new URL(location).searchParams.get('response_mode')).toBe('form_post')
		expect(createAuthorizationURL).toHaveBeenCalled()
	})
})
