import { afterEach, describe, expect, it, vi } from 'vitest'

import { OAuth2RequestError } from '../../src/_internal/oauth2.ts'
import { GoogleProvider } from '../../src/providers/GoogleProvider.ts'

function createLogger() {
	return { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }
}

function createProvider(logger = createLogger()) {
	return {
		logger,
		provider: new GoogleProvider({
			clientId: 'google-client',
			clientSecret: 'google-secret',
			callbackUrl: 'https://bandamp.test/auth/callback/google',
			logger
		})
	}
}

function userInfo(overrides: Record<string, unknown> = {}) {
	return {
		id: 'google-user-1',
		email: 'member@example.com',
		name: 'BandAmp Member',
		picture: 'https://images.example/member.png',
		verified_email: true,
		...overrides
	}
}

afterEach(() => {
	vi.restoreAllMocks()
	vi.unstubAllGlobals()
})

describe('GoogleProvider', () => {
	it('requires complete configuration and builds a PKCE authorization URL', async () => {
		expect(
			() =>
				new GoogleProvider({
					clientId: '',
					clientSecret: 'secret',
					callbackUrl: 'https://bandamp.test/callback'
				})
		).toThrow('requires clientId, clientSecret, and callbackUrl')

		const { provider } = createProvider()
		const authorizationUrl = await provider.createAuthorizationURL('state', 'verifier')

		expect(authorizationUrl.origin).toBe('https://accounts.google.com')
		expect(authorizationUrl.searchParams.get('response_type')).toBe('code')
		expect(authorizationUrl.searchParams.get('client_id')).toBe('google-client')
		expect(authorizationUrl.searchParams.get('redirect_uri')).toBe(
			'https://bandamp.test/auth/callback/google'
		)
		expect(authorizationUrl.searchParams.get('state')).toBe('state')
		expect(authorizationUrl.searchParams.get('scope')).toBe('openid profile email')
		expect(authorizationUrl.searchParams.get('code_challenge_method')).toBe('S256')
		expect(authorizationUrl.searchParams.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/u)
	})

	it('exchanges an authorization code and returns a verified profile', async () => {
		const { provider } = createProvider()
		const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
			if (String(input) === 'https://oauth2.googleapis.com/token') {
				const body = init?.body
				expect(body).toBeInstanceOf(URLSearchParams)
				expect((body as URLSearchParams).get('grant_type')).toBe('authorization_code')
				expect((body as URLSearchParams).get('code_verifier')).toBe('verifier')
				return Response.json({
					access_token: 'access-token',
					refresh_token: 'refresh-token',
					scope: 'openid email',
					expires_in: 3600
				})
			}
			return Response.json(userInfo())
		})
		vi.stubGlobal('fetch', fetcher)
		const before = Date.now()

		const result = await provider.getUserProfile('authorization-code', 'verifier')

		expect(result.profile).toEqual({
			id: 'google-user-1',
			email: 'member@example.com',
			name: 'BandAmp Member',
			picture: 'https://images.example/member.png',
			verified_email: true
		})
		expect(result.tokens).toMatchObject({
			accessToken: 'access-token',
			refreshToken: 'refresh-token',
			scope: 'openid email'
		})
		expect(new Date(result.tokens.accessTokenExpiresAt).getTime()).toBeGreaterThanOrEqual(
			before + 3_600_000
		)
		expect(fetcher).toHaveBeenLastCalledWith(
			'https://www.googleapis.com/oauth2/v1/userinfo?alt=json',
			expect.objectContaining({
				headers: { Authorization: 'Bearer access-token' }
			})
		)
	})

	it('refreshes a token with the provider credentials', async () => {
		const { provider } = createProvider()
		const fetcher = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
			const body = init?.body as URLSearchParams
			expect(body.get('grant_type')).toBe('refresh_token')
			expect(body.get('refresh_token')).toBe('old-refresh-token')
			expect(body.get('client_id')).toBe('google-client')
			return Response.json({
				access_token: 'refreshed-access-token',
				scope: 'openid email',
				expires_in: 1800
			})
		})
		vi.stubGlobal('fetch', fetcher)

		await expect(provider.refreshAccessToken('old-refresh-token')).resolves.toMatchObject({
			accessToken: 'refreshed-access-token',
			refreshToken: null,
			scope: 'openid email'
		})
	})

	it('maps token endpoint errors to a bounded OAuth error', async () => {
		const { provider } = createProvider()
		vi.stubGlobal(
			'fetch',
			vi.fn(async () =>
				Response.json(
					{ error: 'invalid_grant', error_description: 'Authorization code rejected' },
					{ status: 400 }
				)
			)
		)

		await expect(provider.getUserProfile('code', 'verifier')).rejects.toMatchObject<
			Partial<OAuth2RequestError>
		>({ name: 'OAuth2RequestError', code: 'invalid_grant', status: 400 })
	})

	it('rejects a chunked token response before buffering beyond the limit', async () => {
		const { provider } = createProvider()
		const body = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(new Uint8Array(40 * 1024))
				controller.enqueue(new Uint8Array(40 * 1024))
				controller.close()
			}
		})
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response(body))
		)

		await expect(provider.getUserProfile('code', 'verifier')).rejects.toThrow(
			'OAuth token response is too large'
		)
	})

	it.each([
		{
			name: 'non-success user-info response',
			response: new Response(JSON.stringify({ error: 'invalid_token' }), { status: 401 }),
			error: 'Google user info request failed (401)'
		},
		{
			name: 'malformed user profile',
			response: Response.json({ id: 'google-user-1', verified_email: true }),
			error: 'Invalid Google user profile'
		},
		{
			name: 'unverified email',
			response: Response.json(userInfo({ verified_email: false })),
			error: 'Google email not verified'
		}
	])('rejects a $name without logging secrets', async ({ response, error }) => {
		const { provider, logger } = createProvider()
		const secret = 'authorization-secret'
		vi.stubGlobal(
			'fetch',
			vi
				.fn()
				.mockResolvedValueOnce(Response.json({ access_token: secret, expires_in: 60 }))
				.mockResolvedValueOnce(response)
		)

		await expect(provider.getUserProfile('code', 'verifier')).rejects.toThrow(error)
		expect(logger.error).toHaveBeenCalledWith('Error in GoogleProvider.getUserProfile', {
			errorType: 'Error'
		})
		expect(JSON.stringify(logger.error.mock.calls)).not.toContain(secret)
	})
})
