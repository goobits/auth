import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { AppleProvider } from '../../src/providers/AppleProvider.ts'

let appleSigningPrivateKey: CryptoKey
let appleSigningPublicJwk: JsonWebKey
let clientPrivateKey: string

function base64UrlJson(value: unknown): string {
	return Buffer.from(JSON.stringify(value)).toString('base64url')
}

async function appleToken(
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

function createProvider(Provider: typeof AppleProvider = AppleProvider) {
	return new Provider({
		clientId: 'com.example.web',
		teamId: 'TEAM123',
		keyId: 'KEY123',
		privateKey: clientPrivateKey,
		callbackUrl: 'https://example.com/auth/callback/apple',
		logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }
	})
}

async function stubAppleFlow(emailVerified: unknown, nonce = 'verifier') {
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

describe('AppleProvider identity verification', () => {
	it('builds the complete Apple form-post authorization URL with a bound nonce', () => {
		const authorizationUrl = createProvider().createAuthorizationURL('state', 'verifier', ['email'])

		expect(authorizationUrl.origin).toBe('https://appleid.apple.com')
		expect(authorizationUrl.searchParams.get('response_type')).toBe('code')
		expect(authorizationUrl.searchParams.get('response_mode')).toBe('form_post')
		expect(authorizationUrl.searchParams.get('client_id')).toBe('com.example.web')
		expect(authorizationUrl.searchParams.get('redirect_uri')).toBe(
			'https://example.com/auth/callback/apple'
		)
		expect(authorizationUrl.searchParams.get('state')).toBe('state')
		expect(authorizationUrl.searchParams.get('nonce')).toBe('verifier')
		expect(authorizationUrl.searchParams.get('scope')).toBe('email')
		expect(() =>
			createProvider().createAuthorizationURL('state', 'verifier', ['email', 'calendar'])
		).toThrow('only the name and email')
		expect(() => createProvider().createAuthorizationURL('state', 'verifier', ['name'])).toThrow(
			'only the name and email'
		)
	})

	it('exposes only secret-free provider metadata to runtime serialization', () => {
		const provider = createProvider()
		const serialized = JSON.stringify(provider)

		expect(JSON.parse(serialized)).toEqual({ callbackMode: 'form_post', name: 'apple' })
		expect('config' in provider).toBe(false)
		expect(serialized).not.toContain('TEAM123')
		expect(serialized).not.toContain(clientPrivateKey)
	})

	it('rejects object-shaped ID token data instead of bypassing signature verification', async () => {
		const provider = createProvider()
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
		const fetcher = await stubAppleFlow('true')

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

	it('accepts only bounded string fields from one-time Apple name data', async () => {
		const provider = createProvider()
		await stubAppleFlow(true)

		await expect(
			provider.getUserProfile(
				'code',
				'verifier',
				JSON.stringify({ name: { firstName: { controlled: true }, lastName: 'Member' } })
			)
		).resolves.toMatchObject({ profile: { name: 'Member' } })
	})

	it('verifies and normalizes server-to-server account notifications', async () => {
		const provider = createProvider()
		const now = Math.floor(Date.now() / 1000)
		const notification = await appleToken({
			iss: 'https://appleid.apple.com',
			aud: 'com.example.web',
			iat: now,
			jti: 'notification-1',
			events: {
				type: 'email-disabled',
				sub: 'apple-user-1',
				email: 'relay@privaterelay.appleid.com',
				is_private_email: 'true',
				event_time: now
			}
		})
		await stubAppleFlow(true)

		await expect(provider.verifyServerNotification(notification)).resolves.toEqual({
			jwtId: 'notification-1',
			type: 'email-disabled',
			subject: 'apple-user-1',
			email: 'relay@privaterelay.appleid.com',
			isPrivateEmail: true,
			eventTime: now
		})
	})

	it('accepts a bounded serialized events claim with a millisecond timestamp', async () => {
		const provider = createProvider()
		const now = Math.floor(Date.now() / 1000)
		const notification = await appleToken({
			iss: 'https://appleid.apple.com',
			aud: 'com.example.web',
			iat: now,
			jti: 'notification-serialized',
			events: JSON.stringify({
				type: 'consent-revoked',
				sub: 'apple-user-1',
				event_time: now * 1000 + 987
			})
		})
		await stubAppleFlow(true)

		await expect(provider.verifyServerNotification(notification)).resolves.toEqual({
			jwtId: 'notification-serialized',
			type: 'consent-revoked',
			subject: 'apple-user-1',
			eventTime: now
		})
	})

	it('rejects malformed signed server notification events', async () => {
		const provider = createProvider()
		const now = Math.floor(Date.now() / 1000)
		const notification = await appleToken({
			iss: 'https://appleid.apple.com',
			aud: 'com.example.web',
			iat: now,
			jti: 'notification-2',
			events: {
				type: 'email-enabled',
				sub: 'apple-user-1',
				event_time: now
			}
		})
		await stubAppleFlow(true)

		await expect(provider.verifyServerNotification(notification)).rejects.toThrow(
			'Invalid Apple server notification'
		)
	})

	it.each([false, 'false'])(
		'rejects an unverified signed Apple email claim (%s)',
		async (claim) => {
			const provider = createProvider()
			await stubAppleFlow(claim)

			await expect(provider.getUserProfile('code', 'verifier')).rejects.toThrow(
				'Apple email not verified'
			)
		}
	)

	it('rejects a signed token with a missing required email-verification claim', async () => {
		const provider = createProvider()
		await stubAppleFlow(undefined)

		await expect(provider.getUserProfile('code', 'verifier')).rejects.toThrow(
			'Invalid Apple ID token'
		)
	})

	it('rejects a valid Apple signature that is not bound to the authorization nonce', async () => {
		const provider = createProvider()
		await stubAppleFlow(true, 'different-verifier')

		await expect(provider.getUserProfile('code', 'verifier')).rejects.toThrow(
			'Invalid Apple ID token identity'
		)
	})

	it('refreshes JWKS only for unknown key IDs with single-flight and cooldown', async () => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date('2026-08-03T12:00:00.000Z'))
		vi.resetModules()
		const { AppleProvider: FreshAppleProvider } = await import(
			'../../src/providers/AppleProvider.ts'
		)
		const provider = createProvider(FreshAppleProvider)
		const now = Math.floor(Date.now() / 1000)
		const knownKeyToken = await appleToken({
			iss: 'https://appleid.apple.com',
			aud: 'com.example.web',
			iat: now,
			jti: 'known-key-notification',
			events: { type: 'account-deleted', sub: 'apple-user-1', event_time: now }
		})
		const unknownKeyToken = await appleToken(
			{
				iss: 'https://appleid.apple.com',
				aud: 'com.example.web',
				iat: now,
				jti: 'unknown-key-notification',
				events: { type: 'account-deleted', sub: 'apple-user-1', event_time: now }
			},
			'unknown-key'
		)
		const fetcher = vi.fn(async () =>
			Response.json({
				keys: [{ ...appleSigningPublicJwk, kid: 'apple-key-1', use: 'sig', alg: 'RS256' }]
			})
		)
		vi.stubGlobal('fetch', fetcher)

		await expect(provider.verifyServerNotification(knownKeyToken)).resolves.toMatchObject({
			jwtId: 'known-key-notification'
		})
		vi.advanceTimersByTime(60 * 1000 + 1)
		const concurrent = await Promise.allSettled([
			provider.verifyServerNotification(unknownKeyToken),
			provider.verifyServerNotification(unknownKeyToken)
		])
		expect(concurrent.every((result) => result.status === 'rejected')).toBe(true)
		await expect(provider.verifyServerNotification(unknownKeyToken)).rejects.toThrow(
			'Invalid Apple server notification'
		)
		expect(fetcher).toHaveBeenCalledTimes(2)
	})

	it('does not refresh JWKS for a known-key signature failure', async () => {
		vi.resetModules()
		const { AppleProvider: FreshAppleProvider } = await import(
			'../../src/providers/AppleProvider.ts'
		)
		const provider = createProvider(FreshAppleProvider)
		const now = Math.floor(Date.now() / 1000)
		const signed = await appleToken({
			iss: 'https://appleid.apple.com',
			aud: 'com.example.web',
			iat: now,
			jti: 'tampered-notification',
			events: { type: 'account-deleted', sub: 'apple-user-1', event_time: now }
		})
		const [header, claims, signature] = signed.split('.')
		if (!header || !claims || !signature) throw new Error('Malformed test JWT')
		const tamperedSignature = `${signature.startsWith('A') ? 'B' : 'A'}${signature.slice(1)}`
		const tampered = `${header}.${claims}.${tamperedSignature}`
		const fetcher = vi.fn(async () =>
			Response.json({
				keys: [{ ...appleSigningPublicJwk, kid: 'apple-key-1', use: 'sig', alg: 'RS256' }]
			})
		)
		vi.stubGlobal('fetch', fetcher)

		await expect(provider.verifyServerNotification(tampered)).rejects.toThrow(
			'Invalid Apple server notification'
		)
		expect(fetcher).toHaveBeenCalledOnce()
	})

	it('uses stale JWKS during a bounded provider outage', async () => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date('2026-08-03T12:00:00.000Z'))
		vi.resetModules()
		const { AppleProvider: FreshAppleProvider } = await import(
			'../../src/providers/AppleProvider.ts'
		)
		const provider = createProvider(FreshAppleProvider)
		const now = Math.floor(Date.now() / 1000)
		const notification = await appleToken({
			iss: 'https://appleid.apple.com',
			aud: 'com.example.web',
			iat: now,
			jti: 'stale-cache-notification',
			events: { type: 'account-deleted', sub: 'apple-user-1', event_time: now }
		})
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(
				Response.json({
					keys: [{ ...appleSigningPublicJwk, kid: 'apple-key-1', use: 'sig', alg: 'RS256' }]
				})
			)
			.mockRejectedValueOnce(new Error('provider unavailable'))
		vi.stubGlobal('fetch', fetcher)

		await expect(provider.verifyServerNotification(notification)).resolves.toMatchObject({
			jwtId: 'stale-cache-notification'
		})
		vi.advanceTimersByTime(60 * 60 * 1000 + 1)
		await expect(provider.verifyServerNotification(notification)).resolves.toMatchObject({
			jwtId: 'stale-cache-notification'
		})
		expect(fetcher).toHaveBeenCalledTimes(2)
	})

	it('backs off repeated JWKS fetches when no cache is available', async () => {
		vi.resetModules()
		const { AppleProvider: FreshAppleProvider } = await import(
			'../../src/providers/AppleProvider.ts'
		)
		const provider = createProvider(FreshAppleProvider)
		const fetcher = vi.fn(async () => {
			throw new Error('provider unavailable')
		})
		vi.stubGlobal('fetch', fetcher)

		await expect(provider.verifyServerNotification('invalid-token')).rejects.toThrow(
			'Invalid Apple server notification'
		)
		await expect(provider.verifyServerNotification('invalid-token')).rejects.toThrow(
			'Invalid Apple server notification'
		)
		expect(fetcher).toHaveBeenCalledOnce()
	})

	it('treats an already-invalid retained credential as terminally revoked', async () => {
		const provider = createProvider()
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => Response.json({ error: 'invalid_grant' }, { status: 400 }))
		)

		await expect(
			provider.revokeTokens({
				accessToken: 'access-token',
				refreshToken: 'refresh-token',
				scope: null,
				accessTokenExpiresAt: '2026-01-01T00:00:00.000Z'
			})
		).resolves.toBeUndefined()
	})
})
