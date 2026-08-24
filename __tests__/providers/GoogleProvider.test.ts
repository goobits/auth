import { afterEach, describe, expect, it, vi } from 'vitest'

import { OAuth2RequestError } from '../../src/providers/index.ts'
import { GoogleProvider } from '../../src/providers/GoogleProvider.ts'

function createLogger() {
	return { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }
}

function createProvider(logger = createLogger(), accessType?: 'online' | 'offline') {
	return {
		logger,
		provider: new GoogleProvider({
			clientId: 'google-client',
			clientSecret: 'google-secret',
			callbackUrl: 'https://bandamp.test/auth/callback/google',
			...(accessType ? { accessType } : {}),
			logger
		})
	}
}

function userInfo(overrides: Record<string, unknown> = {}) {
	return {
		sub: 'google-user-1',
		email: 'member@example.com',
		name: 'BandAmp Member',
		picture: 'https://images.example/member.png',
		email_verified: true,
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
		expect(authorizationUrl.searchParams.get('access_type')).toBeNull()
		await expect(
			provider.createAuthorizationURL('state', 'verifier', ['openid', 'calendar'])
		).rejects.toThrow('only the openid, profile, and email')
	})

	it('exposes only secret-free provider metadata to runtime serialization', () => {
		const { provider } = createProvider()

		expect(JSON.parse(JSON.stringify(provider))).toEqual({
			callbackMode: 'query',
			name: 'google'
		})
		expect('config' in provider).toBe(false)
		expect(JSON.stringify(provider)).not.toContain('google-secret')
	})

	it('requests an offline refresh credential only when explicitly configured', async () => {
		const { provider } = createProvider(createLogger(), 'offline')
		const authorizationUrl = await provider.createAuthorizationURL('state', 'verifier')

		expect(authorizationUrl.searchParams.get('access_type')).toBe('offline')
		expect(authorizationUrl.searchParams.get('scope')).toBe('openid profile email')
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
			'https://openidconnect.googleapis.com/v1/userinfo',
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
			refreshToken: 'old-refresh-token',
			scope: 'openid email'
		})
	})

	it('treats an already-invalid retained token as terminally revoked', async () => {
		const { provider } = createProvider()
		const fetcher = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
			const body = init?.body as URLSearchParams
			expect(body.get('token')).toBe('refresh-token')
			return Response.json({ error: 'invalid_token' }, { status: 400 })
		})
		vi.stubGlobal('fetch', fetcher)

		await expect(
			provider.revokeTokens({
				accessToken: 'access-token',
				refreshToken: 'refresh-token',
				scope: 'openid email',
				accessTokenExpiresAt: '2026-01-01T00:00:00.000Z'
			})
		).resolves.toBeUndefined()
	})

	it('keeps retryable revocation failures structured and fail-closed', async () => {
		const { provider } = createProvider()
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => Response.json({ error: 'temporarily_unavailable' }, { status: 503 }))
		)

		await expect(
			provider.revokeTokens({
				accessToken: 'access-token',
				refreshToken: null,
				scope: 'openid email',
				accessTokenExpiresAt: '2026-01-01T00:00:00.000Z'
			})
		).rejects.toMatchObject<Partial<OAuth2RequestError>>({
			name: 'OAuth2RequestError',
			code: 'temporarily_unavailable',
			status: 503
		})
	})

	it('does not accept a terminal error code on a transient revocation response', async () => {
		const { provider } = createProvider()
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => Response.json({ error: 'invalid_token' }, { status: 503 }))
		)

		await expect(
			provider.revokeTokens({
				accessToken: 'access-token',
				refreshToken: null,
				scope: 'openid email',
				accessTokenExpiresAt: '2026-01-01T00:00:00.000Z'
			})
		).rejects.toMatchObject<Partial<OAuth2RequestError>>({
			name: 'OAuth2RequestError',
			code: 'invalid_token',
			status: 503
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

		const request = provider.getUserProfile('code', 'verifier')
		await expect(request).rejects.toMatchObject<Partial<OAuth2RequestError>>({
			name: 'OAuth2RequestError',
			code: 'invalid_grant',
			description: 'Authorization code rejected',
			message: 'invalid_grant',
			status: 400
		})
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
			error: 'userinfo_request_failed'
		},
		{
			name: 'malformed user profile',
			response: Response.json({ sub: 'google-user-1', email_verified: true }),
			error: 'Invalid Google user profile'
		},
		{
			name: 'oversized stable subject',
			response: Response.json(userInfo({ sub: 'g'.repeat(256) })),
			error: 'Invalid Google user profile'
		},
		{
			name: 'legacy verification claim',
			response: Response.json({
				...userInfo({ email_verified: undefined }),
				verified_email: true
			}),
			error: 'Invalid Google user profile'
		},
		{
			name: 'unverified email',
			response: Response.json(userInfo({ email_verified: false })),
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
			error_type: error === 'userinfo_request_failed' ? 'OAuth2RequestError' : 'Error'
		})
		expect(JSON.stringify(logger.error.mock.calls)).not.toContain(secret)
	})

	it('accepts an OIDC profile that omits optional display claims', async () => {
		const { provider } = createProvider()
		vi.stubGlobal(
			'fetch',
			vi
				.fn()
				.mockResolvedValueOnce(Response.json({ access_token: 'access-token', expires_in: 60 }))
				.mockResolvedValueOnce(
					Response.json({
						sub: 'google-user-1',
						email: 'member@example.com',
						email_verified: true
					})
				)
		)

		await expect(provider.getUserProfile('code', 'verifier')).resolves.toMatchObject({
			profile: {
				id: 'google-user-1',
				email: 'member@example.com',
				verified_email: true
			}
		})
	})
})
