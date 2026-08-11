import { error as httpError, redirect } from '@sveltejs/kit'
import { describe, expect, it, vi } from 'vitest'

import { BodyTooLargeError } from '@goobits/security/request-body'
import { applySecurityPolicy } from '../../src/security/policy.ts'
import { createAuditSettings, createEvent } from './_policyTestKit.ts'

describe('security policy audit reporting', () => {
	it('uses the shared client bucket when the platform address accessor is unavailable', async () => {
		const emitter = vi.fn()
		const inner = vi.fn(async () => new Response(JSON.stringify({ ok: true })))
		const handler = applySecurityPolicy({
			handler: inner,
			routeId: 'sessions.list',
			settings: createAuditSettings(emitter)
		})
		const event = createEvent()
		event.getClientAddress = () => {
			throw new Error('Client address unavailable')
		}

		const response = await handler(event as Parameters<typeof handler>[0])

		expect(response.status).toBe(200)
		expect(inner).toHaveBeenCalledOnce()
		expect(emitter).toHaveBeenCalledWith(expect.objectContaining({ ip: 'unknown' }))
	})

	it('audits redirects as successful control flow', async () => {
		const emitter = vi.fn()
		const handler = applySecurityPolicy({
			handler: async () => {
				throw redirect(303, '/')
			},
			routeId: 'auth.logout',
			settings: createAuditSettings(emitter)
		})

		await expect(handler(createEvent() as Parameters<typeof handler>[0])).rejects.toMatchObject({
			status: 303,
			location: '/'
		})
		expect(emitter).toHaveBeenCalledWith(
			expect.objectContaining({ name: 'auth.success', severity: 'info', status: 303 })
		)
		expect(emitter).not.toHaveBeenCalledWith(expect.objectContaining({ name: 'auth.failure' }))
	})

	it('preserves expected HTTP failure status and severity in audit events', async () => {
		const emitter = vi.fn()
		const handler = applySecurityPolicy({
			handler: async () => {
				throw httpError(403, 'Forbidden')
			},
			routeId: 'sessions.revoke',
			settings: createAuditSettings(emitter)
		})

		await expect(handler(createEvent() as Parameters<typeof handler>[0])).rejects.toMatchObject({
			status: 403
		})
		expect(emitter).toHaveBeenCalledWith(
			expect.objectContaining({ name: 'auth.failure', severity: 'warn', status: 403 })
		)
	})

	it('returns and audits bounded request-body failures as 413', async () => {
		const emitter = vi.fn()
		const handler = applySecurityPolicy({
			handler: async () => {
				throw new BodyTooLargeError(1_048_576)
			},
			routeId: 'webauthn.login.verify',
			settings: createAuditSettings(emitter)
		})

		const response = await handler(createEvent() as Parameters<typeof handler>[0])

		expect(response.status).toBe(413)
		expect(await response.json()).toEqual({ ok: false, error: 'Request body too large' })
		expect(emitter).toHaveBeenCalledWith(
			expect.objectContaining({ name: 'auth.failure', severity: 'warn', status: 413 })
		)
	})
})
