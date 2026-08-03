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
		})),
		refreshAccessToken: vi.fn(),
		revokeTokens: vi.fn()
	}
}

describe('createLoginHandler', () => {
	it('rejects unknown provider', async () => {
		const handler = createLoginHandler({ providers: {} })
		const response = await handler(createRequestEvent({ params: { provider: 'unknown' } }))
		expect(response.status).toBe(400)
	})

	it('rejects an unknown OAuth intent as a bad request', async () => {
		const handler = createLoginHandler({
			providers: { google: { provider: createProvider() } }
		})
		const response = await handler(
			createRequestEvent({ params: { provider: 'google', intent: 'tampered' } })
		)

		expect(response).toMatchObject({ status: 400 })
		await expect(response.text()).resolves.toBe('Invalid OAuth flow intent')
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
		expect(JSON.parse(cookies._store.get('apple_oauth_context')?.value ?? '')).toMatchObject({
			intent: 'sign-in',
			userId: null
		})
	})

	it('binds explicit provider linking to the current principal and fresh authorization', async () => {
		const authorizeIdentityChange = vi.fn(async () => true)
		const handler = createLoginHandler({
			providers: { google: { provider: createProvider() } },
			authorizeIdentityChange
		})
		const cookies = createCookies()
		const event = createRequestEvent({
			url: 'https://app.example/auth/link/google?returnTo=%2Fsettings%2Fsecurity',
			params: { provider: 'google', intent: 'link' },
			cookies,
			locals: {
				user: {
					id: 'user-1',
					email: 'member@example.com',
					name: 'Member',
					avatar: null,
					emailVerified: true
				},
				session: {
					id: 'session-1',
					userId: 'user-1',
					expiresAt: new Date('2099-01-01T00:00:00.000Z')
				}
			}
		})

		await expect(handler(event)).rejects.toMatchObject({ status: 302 })
		expect(authorizeIdentityChange).toHaveBeenCalledWith(
			expect.objectContaining({ action: 'oauth.link', userId: 'user-1', provider: 'google' })
		)
		expect(JSON.parse(cookies._store.get('google_oauth_context')?.value ?? '')).toMatchObject({
			intent: 'link',
			userId: 'user-1',
			redirectTo: '/settings/security'
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
