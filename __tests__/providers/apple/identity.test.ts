import { describe, expect, it, vi } from 'vitest'

import {
	clientPrivateKey,
	createProvider,
	installAppleTestContext,
	stubAppleFlow
} from './_testKit.ts'

installAppleTestContext()

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
