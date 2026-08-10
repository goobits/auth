import { describe, expect, it } from 'vitest'

import { appleToken, createProvider, installAppleTestContext, stubAppleFlow } from './_testKit.ts'

installAppleTestContext()

describe('AppleProvider server notifications', () => {
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
})
