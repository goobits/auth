import { beforeEach, describe, expect, it, vi } from 'vitest'

import { OAuth2RequestError } from '../../src/_internal/oauth2.ts'
import type { OAuthProvider } from '../../src/providers/OAuthProvider.ts'
import type { OAuthProfile, OAuthTokens } from '../../src/types/index.ts'
import { captureRejected, createRequestEvent, getRedirectLocation } from '../testKit.ts'

type OAuthCallbackHandlers = {
	onAuthenticated?: (
		profile: OAuthProfile,
		tokens: OAuthTokens,
		context: { intent: 'sign-in'; userId: null; redirectTo: string }
	) => Promise<void> | void
	onError?: (error: unknown) => Promise<void> | void
}

type OAuthCallbackInput = {
	callbacks?: OAuthCallbackHandlers
}

const handleOAuthCallback = vi.fn(async ({ callbacks }: OAuthCallbackInput) => {
	if (callbacks?.onAuthenticated) {
		await callbacks.onAuthenticated(
			{ id: 'p1', email: 'p1@example.com' },
			{ accessToken: 't1' },
			{ intent: 'sign-in', userId: null, redirectTo: '/' }
		)
	}
	return { id: 'p1' }
})
vi.mock('../../src/utils/oauth.ts', async (importOriginal) => ({
	...(await importOriginal<typeof import('../../src/utils/oauth.ts')>()),
	handleOAuthCallback: (...args: [OAuthCallbackInput]) => handleOAuthCallback(...args)
}))

import { createCallbackHandler } from '../../src/handlers/callback.ts'
import { OAuthCallbackError } from '../../src/utils/oauth.ts'

function createProvider(callbackMode: 'query' | 'form_post' = 'query'): OAuthProvider {
	return {
		callbackMode,
		createAuthorizationURL: () => new URL('https://example.com/auth'),
		getUserProfile: vi.fn(async () => ({
			profile: { id: 'p1', email: 'p1@example.com' },
			tokens: { accessToken: 't1' }
		})),
		refreshAccessToken: vi.fn(),
		revokeTokens: vi.fn()
	}
}

beforeEach(() => {
	handleOAuthCallback.mockReset()
})

describe('createCallbackHandler', () => {
	it('rejects unknown provider', async () => {
		const handler = createCallbackHandler({
			providers: {},
			onAuthenticated: vi.fn()
		})

		await expect(
			handler(
				createRequestEvent({
					url: 'http://localhost/callback?code=abc&state=123',
					params: { provider: 'unknown' }
				})
			)
		).rejects.toMatchObject({ status: 400 })
	})

	it('handles OAuth2RequestError as 400', async () => {
		const providerError = new OAuth2RequestError('invalid_grant', 'provider detail', 400)
		expect(providerError.message).toBe('invalid_grant')
		expect(providerError.description).toBe('provider detail')
		expect(JSON.stringify(providerError)).not.toContain('provider detail')
		handleOAuthCallback.mockImplementation(() => {
			throw providerError
		})

		const handler = createCallbackHandler({
			providers: { google: createProvider() },
			onAuthenticated: vi.fn()
		})

		await expect(
			handler(
				createRequestEvent({
					url: 'http://localhost/callback?code=abc&state=123',
					params: { provider: 'google' }
				})
			)
		).rejects.toMatchObject({ status: 400 })
	})

	it('maps an upstream OAuth outage to 503', async () => {
		handleOAuthCallback.mockImplementation(() => {
			throw new OAuth2RequestError('provider_unavailable', 'provider detail', 503)
		})

		const handler = createCallbackHandler({
			providers: { google: createProvider() },
			onAuthenticated: vi.fn()
		})

		await expect(
			handler(
				createRequestEvent({
					url: 'http://localhost/callback?code=abc&state=123',
					params: { provider: 'google' }
				})
			)
		).rejects.toMatchObject({ status: 503 })
	})

	it('redirects a state-validated provider cancellation', async () => {
		handleOAuthCallback.mockImplementation(() => {
			throw new OAuthCallbackError('cancelled')
		})

		const handler = createCallbackHandler({
			providers: { google: createProvider() },
			redirectOnCancellation: '/login?oauth=cancelled',
			onAuthenticated: vi.fn()
		})

		const rejected = await captureRejected<{ status?: number; headers?: Headers }>(
			handler(
				createRequestEvent({
					url: 'http://localhost/callback?error=access_denied&state=123',
					params: { provider: 'google' }
				})
			)
		)
		expect(rejected.status).toBe(302)
		expect(getRedirectLocation(rejected)).toBe('/login?oauth=cancelled')
	})

	it('accepts apple POST form and calls onAuthenticated', async () => {
		const onAuthenticated = vi.fn()

		const handler = createCallbackHandler({
			providers: { apple: createProvider('form_post') },
			onAuthenticated
		})

		const error = await captureRejected<{ status?: number; headers?: Headers; location?: string }>(
			handler(
				createRequestEvent({
					url: 'http://localhost/callback?code=abc&state=123',
					method: 'POST',
					params: { provider: 'apple' },
					form: { code: 'code123', state: 'state123', user: JSON.stringify({}) }
				})
			)
		)
		expect(error.status).toBe(302)
		expect(getRedirectLocation(error)).toBe('/')

		expect(handleOAuthCallback).toHaveBeenCalledWith(
			expect.objectContaining({
				provider: 'apple',
				overrideParams: {
					code: 'code123',
					state: 'state123',
					error: null,
					errorDescription: null
				}
			})
		)
		expect(onAuthenticated).toHaveBeenCalled()
	})
})
