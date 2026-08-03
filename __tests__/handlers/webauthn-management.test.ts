import { describe, expect, it, vi } from 'vitest'

import {
	createWebAuthnListCredentialsHandler,
	createWebAuthnRemoveCredentialHandler
} from '../../src/handlers/webauthn.ts'
import { addCredential, createEvent, createWebAuthnAdapter, TEST_USER } from './_webauthnTestKit.ts'

describe('WebAuthn credential management', () => {
	it('lists only public metadata for the authenticated owner', async () => {
		const adapter = createWebAuthnAdapter()
		await addCredential(adapter)
		const handler = createWebAuthnListCredentialsHandler({ webauthnAdapter: adapter })
		const response = await handler(createEvent({ method: 'GET' }))
		const payload = await response.json()

		expect(payload).toEqual({
			ok: true,
			credentials: [
				{
					credentialId: 'AQIDBAcI',
					name: 'Laptop',
					transports: ['internal'],
					createdAt: expect.any(String),
					lastUsedAt: expect.any(String)
				}
			]
		})
		expect(JSON.stringify(payload)).not.toContain('publicKey')
		expect(JSON.stringify(payload)).not.toContain('counter')
	})

	it('deletes only an owned credential after fresh authorization', async () => {
		const adapter = createWebAuthnAdapter()
		await addCredential(adapter)
		const authorizeSecurityChange = vi.fn(async () => true)
		const onCredentialDeleted = vi.fn()
		const handler = createWebAuthnRemoveCredentialHandler({
			webauthnAdapter: adapter,
			authorizeSecurityChange,
			onCredentialDeleted
		})
		const form = new FormData()
		form.set('credentialId', 'AQIDBAcI')
		const event = createEvent({ body: form })
		const response = await handler(event)

		expect(response.status).toBe(200)
		expect(authorizeSecurityChange).toHaveBeenCalledWith(
			expect.objectContaining({ action: 'webauthn.remove', userId: 'u1' })
		)
		expect(onCredentialDeleted).toHaveBeenCalledWith({
			userId: 'u1',
			credentialId: 'AQIDBAcI',
			event
		})
		expect(await adapter.listCredentials('u1')).toEqual([])
	})

	it('cannot remove another owner credential or bypass authorization', async () => {
		const adapter = createWebAuthnAdapter()
		await addCredential(adapter)
		const form = new FormData()
		form.set('credentialId', 'AQIDBAcI')
		const denied = createWebAuthnRemoveCredentialHandler({
			webauthnAdapter: adapter,
			authorizeSecurityChange: vi.fn(async () => false)
		})
		expect((await denied(createEvent({ body: form }))).status).toBe(403)

		const otherUser = { ...TEST_USER, id: 'u2', email: 'u2@example.com' }
		const otherForm = new FormData()
		otherForm.set('credentialId', 'AQIDBAcI')
		const ownerChecked = createWebAuthnRemoveCredentialHandler({
			webauthnAdapter: adapter,
			authorizeSecurityChange: vi.fn(async () => true)
		})
		expect(
			(
				await ownerChecked(
					createEvent({
						body: otherForm,
						user: otherUser,
						session: {
							id: 'session-2',
							userId: 'u2',
							expiresAt: new Date(Date.now() + 60_000)
						}
					})
				)
			).status
		).toBe(404)
		expect(await adapter.listCredentials('u1')).toHaveLength(1)
	})

	it('delegates authorization and removal to one application mutation', async () => {
		const adapter = createWebAuthnAdapter()
		const authorizeSecurityChange = vi.fn(async () => true)
		const mutation = vi.fn(async (input) => {
			expect(authorizeSecurityChange).not.toHaveBeenCalled()
			expect(await input.authorize()).toBe(true)
			return 'success' as const
		})
		const handler = createWebAuthnRemoveCredentialHandler({
			webauthnAdapter: adapter,
			authorizeSecurityChange,
			mutation
		})
		const form = new FormData()
		form.set('credentialId', 'AQIDBAcI')

		expect((await handler(createEvent({ body: form }))).status).toBe(200)
		expect(mutation).toHaveBeenCalledOnce()
		expect(authorizeSecurityChange).toHaveBeenCalledOnce()
	})
})
