import { describe, expect, it, vi } from 'vitest'

import { createLoginHandler } from '../../src/handlers/login.ts'
import type { OAuthProvider } from '../../src/providers/OAuthProvider.ts'
import {
	captureRejected,
	createCookies,
	createRequestEvent,
	getRedirectLocation
} from '../testKit.ts'

function createProvider(
	createAuthorizationURL?: () => URL | Promise<URL>,
	callbackMode: 'query' | 'form_post' = 'query'
): OAuthProvider {
	return {
		callbackMode,
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

	it('awaits provider-owned authorization URLs', async () => {
		const createAuthorizationURL = vi.fn(
			async () => new URL('https://apple.example.com/authorize?response_mode=form_post')
		)
		const handler = createLoginHandler({
			providers: {
				apple: {
					provider: createProvider(createAuthorizationURL, 'form_post'),
					scopes: ['email']
				}
			}
		})
		const cookies = createCookies()

		const error = await captureRejected<{ status?: number; headers?: Headers; location?: string }>(
			handler(createRequestEvent({ params: { provider: 'apple' }, cookies }))
		)
		const location = getRedirectLocation(error)
		expect(error.status).toBe(302)
		expect(location).toBeTruthy()
		if (!location) throw new Error('Missing redirect location')
		expect(new URL(location).searchParams.get('response_mode')).toBe('form_post')
		expect(createAuthorizationURL).toHaveBeenCalled()
		expect(cookies._store.get('apple_oauth_state')?.options).toMatchObject({
			secure: true,
			sameSite: 'none'
		})
	})

	it('rejects insecure cookies for form-post callbacks', async () => {
		const handler = createLoginHandler({
			providers: { apple: { provider: createProvider(undefined, 'form_post') } },
			secureCookies: false
		})

		const response = await handler(createRequestEvent({ params: { provider: 'apple' } }))
		expect(response).toMatchObject({ status: 500 })
	})
})
