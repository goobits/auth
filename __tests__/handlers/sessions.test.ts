import { describe, expect, it, vi } from 'vitest'

import {
	createSessionListHandler,
	createSessionRevokeHandler
} from '../../src/handlers/sessions.ts'
import type { AuthSession, SessionSummary } from '../../src/types/index.ts'

function createEvent(body: Record<string, unknown> | string | null = null) {
	const headers = new Headers()
	let requestBody = body
	if (body && typeof body !== 'string') {
		headers.set('content-type', 'application/json')
		requestBody = JSON.stringify(body)
	}
	return {
		request: new Request('http://localhost', {
			method: 'POST',
			body: (requestBody ?? null) as BodyInit | null,
			headers
		}),
		cookies: {
			delete: vi.fn()
		},
		locals: {
			user: { id: 'u1' },
			session: { id: 's1' }
		},
		url: new URL('http://localhost')
	}
}

describe('session handlers', () => {
	it('lists sessions and marks current', async () => {
		const sessionAdapter = {
			listManagedSessions: vi.fn(async () => [
				{ id: 'm1', userId: 'u1', expiresAt: new Date() },
				{ id: 'm2', userId: 'u1', expiresAt: new Date() }
			])
		}
		const event = createEvent()
		event.locals.session = {
			id: 'secret-current',
			managementId: 'm1',
			userId: 'u1',
			expiresAt: new Date()
		}

		const handler = createSessionListHandler({ sessionAdapter })
		const response = await handler(event)
		const payload = await response.json()
		const sessions = payload.sessions as Array<SessionSummary & { current: boolean }>

		expect(payload.ok).toBe(true)
		expect(sessions.find((s) => s.id === 'm1')?.current).toBe(true)
	})

	it('revokes other sessions', async () => {
		const sessionAdapter = {
			listManagedSessions: vi.fn(async () => [
				{ id: 'm1', userId: 'u1', expiresAt: new Date() },
				{ id: 'm2', userId: 'u1', expiresAt: new Date() }
			]),
			revokeManagedSession: vi.fn(async () => {})
		}
		const event = createEvent({ others: true })
		event.locals.session = {
			id: 'secret-current',
			managementId: 'm1',
			userId: 'u1',
			expiresAt: new Date()
		}

		const handler = createSessionRevokeHandler({ sessionAdapter })
		const response = await handler(event)
		const payload = await response.json()

		expect(payload.ok).toBe(true)
		expect(sessionAdapter.revokeManagedSession).toHaveBeenCalledWith('u1', 'm2')
	})

	it('projects management handles without exposing bearer credentials', async () => {
		const expiresAt = new Date(Date.now() + 60_000)
		const sessionAdapter = {
			listManagedSessions: vi.fn(async () => [
				{
					id: 'public-handle',
					userId: 'u1',
					expiresAt,
					bearerId: 'secret-bearer',
					fingerprint: 'secret-fingerprint'
				}
			])
		}
		const event = createEvent()
		const currentSession: AuthSession = {
			id: 'current-secret-bearer',
			managementId: 'public-handle',
			userId: 'u1',
			expiresAt
		}
		event.locals.session = currentSession

		const response = await createSessionListHandler({ sessionAdapter })(event)
		const payload = await response.json()

		expect(payload.sessions).toEqual([
			expect.objectContaining({ id: 'public-handle', current: true })
		])
		expect(JSON.stringify(payload)).not.toContain('secret-bearer')
		expect(JSON.stringify(payload)).not.toContain('secret-fingerprint')
	})

	it('never falls back to adapters that expose only bearer-session listing', async () => {
		const handler = createSessionListHandler({
			sessionAdapter: {
				listSessions: vi.fn(async () => [
					{ id: 'secret-bearer', userId: 'u1', expiresAt: new Date() }
				])
			} as never
		})

		const response = await handler(createEvent())

		expect(response.status).toBe(501)
		expect(JSON.stringify(await response.json())).not.toContain('secret-bearer')
	})

	it('revokes distinct management handles rather than bearer credentials', async () => {
		const sessionAdapter = {
			listManagedSessions: vi.fn(async () => [
				{
					id: 'public-handle',
					userId: 'u1',
					expiresAt: new Date()
				}
			]),
			revokeManagedSession: vi.fn(async () => {})
		}
		const handler = createSessionRevokeHandler({ sessionAdapter })

		const response = await handler(createEvent({ id: 'public-handle' }))

		expect(response.status).toBe(200)
		expect(sessionAdapter.revokeManagedSession).toHaveBeenCalledWith('u1', 'public-handle')
	})

	it('does not revoke a management handle outside the caller session list', async () => {
		const sessionAdapter = {
			listManagedSessions: vi.fn(async () => [
				{ id: 'owned-handle', userId: 'u1', expiresAt: new Date() }
			]),
			revokeManagedSession: vi.fn(async () => {})
		}
		const handler = createSessionRevokeHandler({ sessionAdapter })

		const response = await handler(createEvent({ id: 'another-owner-handle' }))

		expect(response.status).toBe(404)
		expect(sessionAdapter.revokeManagedSession).not.toHaveBeenCalled()
	})

	it('returns 501 when bulk revoke is unsupported', async () => {
		const sessionAdapter = {}

		const handler = createSessionRevokeHandler({ sessionAdapter })
		const response = await handler(createEvent({ all: true }))
		const payload = await response.json()

		expect(response.status).toBe(501)
		expect(payload.ok).toBe(false)
		expect(payload.error).toContain('not supported')
	})

	it('maps adapter failures to deterministic responses', async () => {
		const sessionAdapter = {
			listManagedSessions: vi.fn(async () => [{ id: 'm2', userId: 'u1', expiresAt: new Date() }]),
			revokeManagedSession: vi.fn(async () => {
				throw new Error('db down')
			})
		}

		const handler = createSessionRevokeHandler({ sessionAdapter })
		const response = await handler(createEvent({ id: 'm2' }))
		const payload = await response.json()

		expect(response.status).toBe(500)
		expect(payload.ok).toBe(false)
		expect(payload.error).toBe('Failed to revoke session')
	})
})
