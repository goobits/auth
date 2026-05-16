import { OAuth2RequestError } from 'arctic'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { OAuthProvider } from '../../src/providers/base.ts'
import type { OAuthProfile, OAuthTokens } from '../../src/types/index.ts'

type OAuthCallbackHandlers = {
	onAuthenticated?: (profile: OAuthProfile, tokens: OAuthTokens) => Promise<void> | void;
	onError?: (error: unknown) => Promise<void> | void;
}

type OAuthCallbackInput = {
	callbacks?: OAuthCallbackHandlers;
}

const handleOAuthCallback = vi.fn(async({ callbacks }: OAuthCallbackInput) => {
	if (callbacks?.onAuthenticated) {
		await callbacks.onAuthenticated({ id: 'p1', email: 'p1@example.com' }, { accessToken: 't1' })
	}
	return { id: 'p1' }
})
vi.mock('../../src/utils/oauth.ts', () => ({
	getOAuthReturnTo: (cookies: { get: (name: string) => string | null }, provider: string) =>
		cookies.get(`${ provider }_oauth_return_to`) ?? null,
	handleOAuthCallback: (...args: [OAuthCallbackInput]) => handleOAuthCallback(...args)
	,
	resolveSafeReturnTo: ({ allowedOrigins = [], requestUrl, returnTo }: {
		allowedOrigins?: string[];
		requestUrl: URL;
		returnTo?: string | null;
	}) => {
		if (!returnTo) return null
		const url = new URL(returnTo, requestUrl.origin)
		if (url.origin === requestUrl.origin) return `${ url.pathname }${ url.search }${ url.hash }`
		return allowedOrigins.includes(url.origin) ? url.toString() : null
	}
}))

import { createCallbackHandler } from '../../src/handlers/callback.ts'

function createCookies(values: Record<string, string> = {}) {
	return {
		delete: vi.fn(),
		get: (name: string) => values[name] ?? null,
		set: vi.fn()
	}
}

function createEvent({ cookies = createCookies(), provider = 'google', method = 'GET', form = {} } = {}) {
	const headers = new Headers()
	if (method === 'POST') {
		headers.set('Content-Type', 'application/x-www-form-urlencoded')
	}
	const request = new Request('http://localhost/callback', {
		method,
		headers,
		body: method === 'POST' ? new URLSearchParams(form as Record<string, string>) : null
	})
	return {
		params: { provider },
		locals: {},
		cookies,
		url: new URL('http://localhost/callback?code=abc&state=123'),
		request
	}
}

function getRedirectLocation(err: { location?: string; headers?: Headers } | null) {
	return err?.location || err?.headers?.get?.('location')
}

function createProvider(): OAuthProvider {
	return {
		createAuthorizationURL: () => new URL('https://example.com/auth'),
		getUserProfile: vi.fn(async() => ({
			profile: { id: 'p1', email: 'p1@example.com' },
			tokens: { accessToken: 't1' }
		}))
	}
}

beforeEach(() => {
	handleOAuthCallback.mockReset()
})

describe('createCallbackHandler', () => {
	it('rejects unknown provider', async() => {
		const handler = createCallbackHandler({
			providers: {},
			onAuthenticated: vi.fn()
		})

		await expect(handler(createEvent({ provider: 'unknown' })))
			.rejects.toMatchObject({ status: 400 })
	})

	it('handles OAuth2RequestError as 400', async() => {
		handleOAuthCallback.mockImplementation(() => {
			throw new OAuth2RequestError('bad', 'invalid_grant', undefined, undefined)
		})

		const handler = createCallbackHandler({
			providers: { google: createProvider() },
			onAuthenticated: vi.fn()
		})

		await expect(handler(createEvent({ provider: 'google' })))
			.rejects.toMatchObject({ status: 400 })
	})

	it('accepts apple POST form and calls onAuthenticated', async() => {
		const onAuthenticated = vi.fn()

		const handler = createCallbackHandler({
			providers: { apple: createProvider() },
			onAuthenticated
		})

		try {
			await handler(createEvent({
				provider: 'apple',
				method: 'POST',
				form: { code: 'code123', state: 'state123', user: JSON.stringify({}) }
			}))
		} catch(err) {
			const error = err as { status?: number; headers?: Headers; location?: string }
			expect(error.status).toBe(302)
			expect(getRedirectLocation(error)).toBe('/')
		}

		expect(handleOAuthCallback).toHaveBeenCalledWith(expect.objectContaining({
			provider: 'apple',
			overrideParams: { code: 'code123', state: 'state123' }
		}))
		expect(onAuthenticated).toHaveBeenCalled()
	})

	it('redirects to the stored safe returnTo after OAuth callback', async() => {
		const handler = createCallbackHandler({
			allowedReturnToOrigins: [ 'https://billing.example' ],
			providers: { google: createProvider() },
			onAuthenticated: vi.fn()
		})

		await expect(handler(createEvent({
			cookies: createCookies({
				google_oauth_return_to: 'https://billing.example/account'
			})
		}))).rejects.toMatchObject({
			status: 302,
			location: 'https://billing.example/account'
		})
	})

	it('falls back when the stored returnTo is unsafe', async() => {
		const handler = createCallbackHandler({
			providers: { google: createProvider() },
			redirectAfterLogin: '/home',
			onAuthenticated: vi.fn()
		})

		await expect(handler(createEvent({
			cookies: createCookies({
				google_oauth_return_to: 'https://evil.example/account'
			})
		}))).rejects.toMatchObject({
			status: 302,
			location: '/home'
		})
	})
})
