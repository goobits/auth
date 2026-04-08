import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OAuth2RequestError } from 'arctic'
import type { OAuthProvider } from '../../src/providers/base.ts'
import type { OAuthProfile, OAuthTokens } from '../../src/types/index.ts'
import { captureRejected, createRequestEvent, getRedirectLocation } from '../test-kit.ts'

type OAuthCallbackHandlers = {
	onAuthenticated?: (profile: OAuthProfile, tokens: OAuthTokens) => Promise<void> | void;
	onError?: (error: unknown) => Promise<void> | void;
}

type OAuthCallbackInput = {
	callbacks?: OAuthCallbackHandlers;
}

const handleOAuthCallback = vi.fn(async ({ callbacks }: OAuthCallbackInput) => {
	if (callbacks?.onAuthenticated) {
		await callbacks.onAuthenticated({ id: 'p1', email: 'p1@example.com' }, { accessToken: 't1' })
	}
	return { id: 'p1' }
})
vi.mock('../../src/utils/oauth.ts', () => ({
	handleOAuthCallback: (...args: [OAuthCallbackInput]) => handleOAuthCallback(...args)
}))

import { createCallbackHandler } from '../../src/handlers/callback.ts'

function createProvider(): OAuthProvider {
	return {
		createAuthorizationURL: () => new URL('https://example.com/auth'),
		getUserProfile: vi.fn(async () => ({
			profile: { id: 'p1', email: 'p1@example.com' },
			tokens: { accessToken: 't1' }
		}))
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

		await expect(handler(createRequestEvent({
			url: 'http://localhost/callback?code=abc&state=123',
			params: { provider: 'unknown' }
		})))
			.rejects.toMatchObject({ status: 400 })
	})

	it('handles OAuth2RequestError as 400', async () => {
		handleOAuthCallback.mockImplementation(() => {
			throw new OAuth2RequestError('bad', 'invalid_grant', undefined, undefined)
		})

		const handler = createCallbackHandler({
			providers: { google: createProvider() },
			onAuthenticated: vi.fn()
		})

		await expect(handler(createRequestEvent({
			url: 'http://localhost/callback?code=abc&state=123',
			params: { provider: 'google' }
		})))
			.rejects.toMatchObject({ status: 400 })
	})

	it('accepts apple POST form and calls onAuthenticated', async () => {
		const onAuthenticated = vi.fn()

		const handler = createCallbackHandler({
			providers: { apple: createProvider() },
			onAuthenticated
		})

		const error = await captureRejected<{ status?: number; headers?: Headers; location?: string }>(
			handler(createRequestEvent({
				url: 'http://localhost/callback?code=abc&state=123',
				method: 'POST',
				params: { provider: 'apple' },
				form: { code: 'code123', state: 'state123', user: JSON.stringify({}) }
			}))
		)
		expect(error.status).toBe(302)
		expect(getRedirectLocation(error)).toBe('/')

		expect(handleOAuthCallback).toHaveBeenCalledWith(expect.objectContaining({
			provider: 'apple',
			overrideParams: { code: 'code123', state: 'state123' }
		}))
		expect(onAuthenticated).toHaveBeenCalled()
	})
})
