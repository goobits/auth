import { afterEach, describe, expect, it, vi } from 'vitest'

import { AppleProvider } from '../../src/providers/AppleProvider.ts'

function base64UrlJson(value: unknown): string {
	return Buffer.from(JSON.stringify(value)).toString('base64url')
}

function appleToken(payload: Record<string, unknown>): string {
	return `${base64UrlJson({ alg: 'RS256', kid: 'apple-key-1' })}.${base64UrlJson(payload)}.${Buffer.from('signature').toString('base64url')}`
}

function createProvider() {
	return new AppleProvider({
		clientId: 'com.example.web',
		teamId: 'TEAM123',
		keyId: 'KEY123',
		privateKey: Buffer.from('private-key').toString('base64'),
		callbackUrl: 'https://example.com/auth/apple/callback',
		logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }
	})
}

function mockAppleCrypto() {
	vi.spyOn(globalThis.crypto.subtle, 'importKey').mockResolvedValue({} as CryptoKey)
	vi.spyOn(globalThis.crypto.subtle, 'sign').mockResolvedValue(new Uint8Array(64).buffer)
	vi.spyOn(globalThis.crypto.subtle, 'verify').mockResolvedValue(true)
}

function stubAppleFlow(emailVerified: unknown) {
	const now = Math.floor(Date.now() / 1000)
	const fetcher = vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
		if (String(input) === 'https://appleid.apple.com/auth/token') {
			return Response.json({
				id_token: appleToken({
					iss: 'https://appleid.apple.com',
					aud: 'com.example.web',
					exp: now + 300,
					iat: now,
					sub: 'apple-user-1',
					email: 'relay@privaterelay.appleid.com',
					email_verified: emailVerified
				}),
				access_token: 'access-token',
				refresh_token: 'refresh-token',
				expires_in: 3600
			})
		}
		return Response.json({
			keys: [{ kty: 'RSA', kid: 'apple-key-1', use: 'sig', alg: 'RS256' }]
		})
	})
	vi.stubGlobal('fetch', fetcher)
	return fetcher
}

afterEach(() => {
	vi.restoreAllMocks()
	vi.unstubAllGlobals()
})

describe('AppleProvider identity verification', () => {
	it('builds the complete Apple form-post authorization URL', () => {
		const authorizationUrl = createProvider().createAuthorizationURL('state', 'unused', ['email'])

		expect(authorizationUrl.origin).toBe('https://appleid.apple.com')
		expect(authorizationUrl.searchParams.get('response_type')).toBe('code')
		expect(authorizationUrl.searchParams.get('response_mode')).toBe('form_post')
		expect(authorizationUrl.searchParams.get('client_id')).toBe('com.example.web')
		expect(authorizationUrl.searchParams.get('state')).toBe('state')
		expect(authorizationUrl.searchParams.get('scope')).toBe('email')
	})

	it('rejects object-shaped ID token data instead of bypassing signature verification', async () => {
		const provider = createProvider()
		mockAppleCrypto()
		vi.stubGlobal(
			'fetch',
			vi.fn(async () =>
				Response.json({
					id_token: { email: 'victim@example.com', sub: 'attacker-controlled' },
					access_token: 'access-token'
				})
			)
		)

		await expect(provider.getUserProfile('code', 'verifier')).rejects.toThrow(
			'Missing Apple ID token'
		)
	})

	it('signs a short-lived client secret and trusts only a verified Apple claim', async () => {
		const provider = createProvider()
		mockAppleCrypto()
		const fetcher = stubAppleFlow('true')

		await expect(provider.getUserProfile('code', 'verifier')).resolves.toMatchObject({
			profile: {
				id: 'apple-user-1',
				email: 'relay@privaterelay.appleid.com',
				verified_email: true
			},
			tokens: {
				accessToken: 'access-token',
				refreshToken: 'refresh-token'
			}
		})

		const tokenCall = fetcher.mock.calls.find(
			([input]) => String(input) === 'https://appleid.apple.com/auth/token'
		)
		const body = tokenCall?.[1]?.body as URLSearchParams
		const clientSecret = body.get('client_secret')
		expect(clientSecret?.split('.')).toHaveLength(3)
		if (!clientSecret) throw new Error('Missing Apple client secret')
		const claims = JSON.parse(Buffer.from(clientSecret.split('.')[1] ?? '', 'base64url').toString())
		expect(claims).toMatchObject({
			iss: 'TEAM123',
			aud: 'https://appleid.apple.com',
			sub: 'com.example.web'
		})
		expect(claims.exp - claims.iat).toBe(300)
	})

	it.each([false, 'false', undefined])(
		'rejects an unverified or missing signed Apple email claim (%s)',
		async (claim) => {
			const provider = createProvider()
			mockAppleCrypto()
			stubAppleFlow(claim)

			await expect(provider.getUserProfile('code', 'verifier')).rejects.toThrow(
				'Apple email not verified'
			)
		}
	)
})
