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

afterEach(() => {
	vi.restoreAllMocks()
	vi.unstubAllGlobals()
})

describe('AppleProvider identity verification', () => {
	it('rejects object-shaped ID token data instead of bypassing signature verification', async () => {
		const provider = createProvider()
		Reflect.set(provider, 'client', {
			validateAuthorizationCode: async () => ({
				idToken: () => ({ email: 'victim@example.com', sub: 'attacker-controlled' })
			})
		})

		await expect(provider.getUserProfile('code', 'verifier')).rejects.toThrow(
			'Missing Apple ID token'
		)
	})

	it('derives email verification only from a signed Apple claim', async () => {
		const now = Math.floor(Date.now() / 1000)
		const provider = createProvider()
		Reflect.set(provider, 'client', {
			validateAuthorizationCode: async () => ({
				idToken: appleToken({
					iss: 'https://appleid.apple.com',
					aud: 'com.example.web',
					exp: now + 300,
					iat: now,
					sub: 'apple-user-1',
					email: 'relay@privaterelay.appleid.com',
					email_verified: 'true'
				}),
				accessToken: 'access-token'
			})
		})
		vi.spyOn(globalThis.crypto.subtle, 'importKey').mockResolvedValue({} as CryptoKey)
		vi.spyOn(globalThis.crypto.subtle, 'verify').mockResolvedValue(true)
		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							keys: [{ kty: 'RSA', kid: 'apple-key-1', use: 'sig', alg: 'RS256' }]
						}),
						{ status: 200, headers: { 'content-type': 'application/json' } }
					)
			)
		)

		await expect(provider.getUserProfile('code', 'verifier')).resolves.toMatchObject({
			profile: {
				id: 'apple-user-1',
				email: 'relay@privaterelay.appleid.com',
				verified_email: true
			}
		})
	})
})
