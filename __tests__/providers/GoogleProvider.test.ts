import { afterEach, describe, expect, it, vi } from 'vitest'

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
	it('requires complete configuration and delegates authorization URLs', () => {
		expect(
			() =>
				new GoogleProvider({
					clientId: '',
					clientSecret: 'secret',
					callbackUrl: 'https://bandamp.test/callback'
				})
		).toThrow('requires clientId, clientSecret, and callbackUrl')

		const { provider } = createProvider()
		const createAuthorizationURL = vi.fn(() => new URL('https://accounts.google.test/auth'))
		Reflect.set(provider, 'client', { createAuthorizationURL })

		expect(provider.createAuthorizationURL('state', 'verifier').href).toBe(
			'https://accounts.google.test/auth'
		)
		expect(createAuthorizationURL).toHaveBeenCalledWith('state', 'verifier', [
			'openid',
			'profile',
			'email'
		])
	})

	it('normalizes data-shaped token responses and verified profiles', async () => {
		const { provider } = createProvider()
		Reflect.set(provider, 'client', {
			validateAuthorizationCode: vi.fn(async () => ({
				data: {
					access_token: 'data-access-token',
					refresh_token: 'data-refresh-token',
					scope: 'openid email',
					expires_in: 3600
				}
			}))
		})
		const fetcher = vi.fn(async () => Response.json(userInfo()))
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
			accessToken: 'data-access-token',
			refreshToken: 'data-refresh-token',
			scope: 'openid email'
		})
		expect(new Date(result.tokens.accessTokenExpiresAt).getTime()).toBeGreaterThanOrEqual(
			before + 3_600_000
		)
		expect(fetcher).toHaveBeenCalledWith(
			'https://www.googleapis.com/oauth2/v1/userinfo?alt=json',
			expect.objectContaining({
				headers: { Authorization: 'Bearer data-access-token' }
			})
		)
	})

	it('supports method-shaped Arctic tokens for login and refresh', async () => {
		const { provider } = createProvider()
		const expiresAt = new Date('2026-07-20T00:00:00.000Z')
		const loginTokens = {
			accessToken: () => 'method-access-token',
			refreshToken: () => 'method-refresh-token',
			hasRefreshToken: () => true,
			scopes: () => ['openid', 'profile'],
			hasScopes: () => true,
			accessTokenExpiresAt: () => expiresAt
		}
		const refreshTokens = {
			accessToken: () => 'refreshed-access-token',
			hasRefreshToken: () => false,
			scopes: () => ['openid', 'email'],
			hasScopes: () => true,
			accessTokenExpiresAt: () => expiresAt
		}
		Reflect.set(provider, 'client', {
			validateAuthorizationCode: vi.fn(async () => loginTokens),
			refreshAccessToken: vi.fn(async () => refreshTokens)
		})
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => Response.json(userInfo({ picture: undefined })))
		)

		await expect(provider.getUserProfile('code', 'verifier')).resolves.toMatchObject({
			tokens: {
				accessToken: 'method-access-token',
				refreshToken: 'method-refresh-token',
				scope: 'openid profile',
				accessTokenExpiresAt: expiresAt.toISOString()
			}
		})
		await expect(provider.refreshAccessToken('old-refresh-token')).resolves.toEqual({
			accessToken: 'refreshed-access-token',
			refreshToken: null,
			scope: 'openid email',
			accessTokenExpiresAt: expiresAt.toISOString()
		})
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
		Reflect.set(provider, 'client', {
			validateAuthorizationCode: vi.fn(async () => ({ accessToken: secret, expiresIn: 60 }))
		})
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => response)
		)

		await expect(provider.getUserProfile('code', 'verifier')).rejects.toThrow(error)
		expect(logger.error).toHaveBeenCalledWith('Error in GoogleProvider.getUserProfile', {
			errorType: 'Error'
		})
		expect(JSON.stringify(logger.error.mock.calls)).not.toContain(secret)
	})
})
