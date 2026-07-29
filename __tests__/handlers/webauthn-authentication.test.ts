import { generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
	createWebAuthnLoginOptionsHandler,
	createWebAuthnLoginVerifyHandler,
	createWebAuthnStepUpOptionsHandler,
	createWebAuthnStepUpVerifyHandler
} from '../../src/handlers/webauthn.ts'
import { addCredential, createEvent, createWebAuthnAdapter, TEST_USER } from './_webauthnTestKit.ts'

vi.mock('@simplewebauthn/server', () => ({
	generateAuthenticationOptions: vi.fn(() => ({ challenge: 'authentication-challenge' })),
	verifyAuthenticationResponse: vi.fn(() => ({
		verified: true,
		authenticationInfo: { newCounter: 0 }
	}))
}))

describe('WebAuthn authentication', () => {
	beforeEach(() => vi.clearAllMocks())

	it('creates identifierless options with uniform user-verification requirements', async () => {
		const adapter = createWebAuthnAdapter()
		const handler = createWebAuthnLoginOptionsHandler({
			webauthnAdapter: adapter,
			rpID: 'example.com'
		})
		const response = await handler(createEvent({ body: { email: 'ignored@example.com' } }))
		const payload = await response.json()

		expect(generateAuthenticationOptions).toHaveBeenCalledWith({
			rpID: 'example.com',
			timeout: 60_000,
			userVerification: 'required'
		})
		expect(await adapter.getChallenge(payload.challengeId)).toEqual(
			expect.objectContaining({ userId: null, type: 'authentication' })
		)
	})

	it('creates an assured session for the immutable credential owner', async () => {
		const adapter = createWebAuthnAdapter()
		await addCredential(adapter)
		await adapter.createChallenge({
			challengeId: 'login-1',
			userId: null,
			challenge: 'authentication-challenge',
			type: 'authentication',
			expiresAt: new Date(Date.now() + 60_000)
		})
		const sessionAdapter = {
			createSession: vi.fn(async (userId, metadata) => ({
				id: 'new-session',
				userId,
				expiresAt: new Date(Date.now() + 60_000),
				...metadata
			})),
			setSessionCookie: vi.fn()
		}
		const handler = createWebAuthnLoginVerifyHandler({
			webauthnAdapter: adapter,
			userAdapter: { getUserById: vi.fn(async () => TEST_USER) },
			sessionAdapter,
			getSessionMetadata: vi.fn(async () => ({ fingerprint: 'fingerprint-1' })),
			rpID: 'example.com',
			origin: 'http://localhost'
		})
		const response = await handler(
			createEvent({
				body: { challengeId: 'login-1', credential: { id: 'AQIDBAcI', response: {} } }
			})
		)

		expect(response.status).toBe(200)
		expect(verifyAuthenticationResponse).toHaveBeenCalledWith(
			expect.objectContaining({ requireUserVerification: true })
		)
		expect(sessionAdapter.createSession).toHaveBeenCalledWith(
			'u1',
			expect.objectContaining({
				fingerprint: 'fingerprint-1',
				mfaVerifiedAt: expect.any(Date)
			})
		)
		expect(sessionAdapter.setSessionCookie).toHaveBeenCalledOnce()
	})

	it('rejects principal-bound login challenges and counter regressions', async () => {
		const adapter = createWebAuthnAdapter()
		await addCredential(adapter, { counter: 7 })
		await adapter.createChallenge({
			challengeId: 'bound-login',
			userId: 'u1',
			challenge: 'authentication-challenge',
			type: 'authentication',
			expiresAt: new Date(Date.now() + 60_000)
		})
		const sessionAdapter = { createSession: vi.fn(), setSessionCookie: vi.fn() }
		const handler = createWebAuthnLoginVerifyHandler({
			webauthnAdapter: adapter,
			userAdapter: { getUserById: vi.fn(async () => TEST_USER) },
			sessionAdapter,
			rpID: 'example.com',
			origin: 'http://localhost'
		})
		expect(
			(
				await handler(
					createEvent({
						body: {
							challengeId: 'bound-login',
							credential: { id: 'AQIDBAcI', response: {} }
						}
					})
				)
			).status
		).toBe(403)

		vi.mocked(verifyAuthenticationResponse).mockResolvedValueOnce({
			verified: true,
			authenticationInfo: { newCounter: 6 }
		} as never)
		await adapter.createChallenge({
			challengeId: 'regression',
			userId: null,
			challenge: 'authentication-challenge',
			type: 'authentication',
			expiresAt: new Date(Date.now() + 60_000)
		})
		expect(
			(
				await handler(
					createEvent({
						body: {
							challengeId: 'regression',
							credential: { id: 'AQIDBAcI', response: {} }
						}
					})
				)
			).status
		).toBe(409)
		expect(sessionAdapter.createSession).not.toHaveBeenCalled()
	})

	it('uses an owned passkey to rotate a current session for step-up', async () => {
		const adapter = createWebAuthnAdapter()
		await addCredential(adapter)
		const optionsHandler = createWebAuthnStepUpOptionsHandler({
			webauthnAdapter: adapter,
			rpID: 'example.com'
		})
		const optionsResponse = await optionsHandler(createEvent())
		const { challengeId } = await optionsResponse.json()
		expect(generateAuthenticationOptions).toHaveBeenLastCalledWith(
			expect.objectContaining({
				userVerification: 'required',
				allowCredentials: [expect.objectContaining({ id: 'AQIDBAcI' })]
			})
		)

		const sessionAdapter = {
			createSession: vi.fn(async (userId, metadata) => ({
				id: 'rotated-session',
				userId,
				expiresAt: new Date(Date.now() + 60_000),
				...metadata
			})),
			invalidateSession: vi.fn(async () => undefined),
			setSessionCookie: vi.fn()
		}
		const verifyHandler = createWebAuthnStepUpVerifyHandler({
			webauthnAdapter: adapter,
			sessionAdapter,
			rpID: 'example.com',
			origin: 'http://localhost'
		})
		const response = await verifyHandler(
			createEvent({
				body: { challengeId, credential: { id: 'AQIDBAcI', response: {} } }
			})
		)
		const payload = await response.json()

		expect(response.status).toBe(200)
		expect(payload.mfaVerifiedAt).toEqual(expect.any(String))
		expect(sessionAdapter.invalidateSession).toHaveBeenCalledWith('session-1')
		expect(sessionAdapter.setSessionCookie).toHaveBeenCalledOnce()
	})
})
