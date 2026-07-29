import { generateRegistrationOptions, verifyRegistrationResponse } from '@simplewebauthn/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
	createWebAuthnRegisterOptionsHandler,
	createWebAuthnRegisterVerifyHandler
} from '../../src/handlers/webauthn.ts'
import { addCredential, createEvent, createWebAuthnAdapter } from './_webauthnTestKit.ts'

vi.mock('@simplewebauthn/server', () => ({
	generateRegistrationOptions: vi.fn(() => ({
		challenge: 'registration-challenge'
	})),
	verifyRegistrationResponse: vi.fn(() => ({
		verified: true,
		registrationInfo: {
			credential: {
				id: 'AQIDBAcI',
				publicKey: new Uint8Array([1, 2, 3]),
				counter: 0
			}
		}
	}))
}))

describe('WebAuthn registration', () => {
	beforeEach(() => vi.clearAllMocks())

	it('creates only discoverable, user-verifying credentials after fresh authorization', async () => {
		const adapter = createWebAuthnAdapter()
		await adapter.createChallenge({
			challengeId: 'expired',
			userId: 'u1',
			challenge: 'expired',
			type: 'registration',
			expiresAt: new Date(0)
		})
		const authorizeSecurityChange = vi.fn(async () => true)
		const handler = createWebAuthnRegisterOptionsHandler({
			authorizeSecurityChange,
			webauthnAdapter: adapter,
			rpName: 'Example',
			rpID: 'example.com'
		})

		const response = await handler(createEvent())
		const payload = await response.json()

		expect(response.status).toBe(200)
		expect(authorizeSecurityChange).toHaveBeenCalledWith(
			expect.objectContaining({ action: 'webauthn.register', userId: 'u1' })
		)
		expect(generateRegistrationOptions).toHaveBeenCalledWith(
			expect.objectContaining({
				authenticatorSelection: expect.objectContaining({
					residentKey: 'required',
					requireResidentKey: true,
					userVerification: 'required'
				})
			})
		)
		expect(await adapter.getChallenge('expired')).toBeNull()
		expect(await adapter.getChallenge(payload.challengeId)).toEqual(
			expect.objectContaining({
				userId: 'u1',
				type: 'registration',
				challenge: 'registration-challenge'
			})
		)
	})

	it('denies options without authorization and enforces the credential bound', async () => {
		const adapter = createWebAuthnAdapter()
		const denied = createWebAuthnRegisterOptionsHandler({
			authorizeSecurityChange: vi.fn(async () => false),
			webauthnAdapter: adapter,
			rpName: 'Example',
			rpID: 'example.com'
		})
		expect((await denied(createEvent())).status).toBe(403)

		await addCredential(adapter)
		const limited = createWebAuthnRegisterOptionsHandler({
			authorizeSecurityChange: vi.fn(async () => true),
			webauthnAdapter: adapter,
			rpName: 'Example',
			rpID: 'example.com',
			maxCredentialsPerUser: 1
		})
		expect((await limited(createEvent())).status).toBe(409)
	})

	it('consumes an owner-bound challenge and persists no private material in audit events', async () => {
		const adapter = createWebAuthnAdapter()
		const emitSecurityEvent = vi.fn()
		const onCredentialCreated = vi.fn()
		await adapter.createChallenge({
			challengeId: 'register-1',
			userId: 'u1',
			challenge: 'registration-challenge',
			type: 'registration',
			expiresAt: new Date(Date.now() + 60_000)
		})
		const handler = createWebAuthnRegisterVerifyHandler({
			webauthnAdapter: adapter,
			rpID: 'example.com',
			origin: 'http://localhost',
			onCredentialCreated,
			emitSecurityEvent
		})

		const event = createEvent({
			body: {
				challengeId: 'register-1',
				credential: { id: 'AQIDBAcI' },
				name: 'Laptop'
			}
		})
		const response = await handler(event)

		expect(response.status).toBe(200)
		expect(verifyRegistrationResponse).toHaveBeenCalledWith(
			expect.objectContaining({ requireUserVerification: true })
		)
		expect(await adapter.listCredentials('u1')).toEqual([
			expect.objectContaining({ credentialId: 'AQIDBAcI', name: 'Laptop', counter: 0 })
		])
		expect(onCredentialCreated).toHaveBeenCalledWith({
			userId: 'u1',
			credentialId: 'AQIDBAcI',
			event
		})
		expect(JSON.stringify(emitSecurityEvent.mock.calls)).not.toContain('AQID')
		expect(JSON.stringify(emitSecurityEvent.mock.calls)).not.toContain('registration-challenge')
	})

	it('rejects a registration challenge owned by another principal', async () => {
		const adapter = createWebAuthnAdapter()
		await adapter.createChallenge({
			challengeId: 'register-other',
			userId: 'u2',
			challenge: 'registration-challenge',
			type: 'registration',
			expiresAt: new Date(Date.now() + 60_000)
		})
		const handler = createWebAuthnRegisterVerifyHandler({
			webauthnAdapter: adapter,
			rpID: 'example.com',
			origin: 'http://localhost'
		})
		const response = await handler(
			createEvent({
				body: { challengeId: 'register-other', credential: { id: 'AQIDBAcI' } }
			})
		)
		expect(response.status).toBe(403)
		expect(await adapter.listCredentials('u1')).toEqual([])
	})
})
