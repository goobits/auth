import { describe, expect, it, vi } from 'vitest'

import {
	appleSigningPublicJwk,
	appleToken,
	createFreshAppleProvider,
	installAppleTestContext
} from './_testKit.ts'

installAppleTestContext()

describe('AppleProvider JWKS lifecycle', () => {
	it('refreshes JWKS only for unknown key IDs with single-flight and cooldown', async () => {
		const provider = await createFreshAppleProvider('2026-08-03T12:00:00.000Z')
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
		const provider = await createFreshAppleProvider()
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
		const provider = await createFreshAppleProvider('2026-08-03T12:00:00.000Z')
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
		const provider = await createFreshAppleProvider()
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
})
