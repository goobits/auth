import { afterEach, beforeAll, vi } from 'vitest'

import { AppleProvider } from '../../../src/providers/AppleProvider.ts'

let appleSigningPrivateKey: CryptoKey
export let appleSigningPublicJwk: JsonWebKey
export let clientPrivateKey: string

function base64UrlJson(value: unknown): string {
	return Buffer.from(JSON.stringify(value)).toString('base64url')
}

export async function appleToken(
	payload: Record<string, unknown>,
	keyId = 'apple-key-1'
): Promise<string> {
	const signingInput = `${base64UrlJson({ alg: 'RS256', kid: keyId })}.${base64UrlJson(payload)}`
	const signature = await crypto.subtle.sign(
		'RSASSA-PKCS1-v1_5',
		appleSigningPrivateKey,
		Buffer.from(signingInput)
	)
	return `${signingInput}.${Buffer.from(signature).toString('base64url')}`
}

export function createProvider(Provider: typeof AppleProvider = AppleProvider) {
	return new Provider({
		clientId: 'com.example.web',
		teamId: 'TEAM123',
		keyId: 'KEY123',
		privateKey: clientPrivateKey,
		callbackUrl: 'https://example.com/auth/callback/apple',
		logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }
	})
}

export async function createFreshAppleProvider(systemTime?: string) {
	if (systemTime) {
		vi.useFakeTimers()
		vi.setSystemTime(new Date(systemTime))
	}
	vi.resetModules()
	const { AppleProvider: FreshAppleProvider } =
		await import('../../../src/providers/AppleProvider.ts')
	return createProvider(FreshAppleProvider)
}

export async function stubAppleFlow(emailVerified: unknown, nonce = 'verifier') {
	const now = Math.floor(Date.now() / 1000)
	const idToken = await appleToken({
		iss: 'https://appleid.apple.com',
		aud: 'com.example.web',
		exp: now + 300,
		iat: now,
		sub: 'apple-user-1',
		email: 'relay@privaterelay.appleid.com',
		email_verified: emailVerified,
		nonce
	})
	const fetcher = vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
		if (String(input) === 'https://appleid.apple.com/auth/token') {
			return Response.json({
				id_token: idToken,
				access_token: 'access-token',
				refresh_token: 'refresh-token',
				expires_in: 3600
			})
		}
		return Response.json({
			keys: [{ ...appleSigningPublicJwk, kid: 'apple-key-1', use: 'sig', alg: 'RS256' }]
		})
	})
	vi.stubGlobal('fetch', fetcher)
	return fetcher
}

export function installAppleTestContext() {
	beforeAll(async () => {
		const appleKeyPair = (await crypto.subtle.generateKey(
			{
				name: 'RSASSA-PKCS1-v1_5',
				modulusLength: 2048,
				publicExponent: new Uint8Array([1, 0, 1]),
				hash: 'SHA-256'
			},
			true,
			['sign', 'verify']
		)) as CryptoKeyPair
		appleSigningPrivateKey = appleKeyPair.privateKey
		appleSigningPublicJwk = await crypto.subtle.exportKey('jwk', appleKeyPair.publicKey)

		const clientKeyPair = (await crypto.subtle.generateKey(
			{ name: 'ECDSA', namedCurve: 'P-256' },
			true,
			['sign', 'verify']
		)) as CryptoKeyPair
		clientPrivateKey = Buffer.from(
			await crypto.subtle.exportKey('pkcs8', clientKeyPair.privateKey)
		).toString('base64')
	})

	afterEach(() => {
		vi.useRealTimers()
		vi.restoreAllMocks()
		vi.unstubAllGlobals()
	})
}
