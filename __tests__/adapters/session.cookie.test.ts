import { describe, it, expect, vi } from 'vitest'
import { CookieSessionAdapter } from '../../src/adapters/session/cookie.ts'
import { createCookies } from '../test-kit.ts'

type CookieSessionAdapterInternals = {
	_sessions: Map<string, unknown>;
}

describe('CookieSessionAdapter', () => {
	it('expires sessions and deletes them', async () => {
		const adapter = new CookieSessionAdapter({ sessionLifetime: 10 })
		const session = await adapter.createSession('u1')
		vi.spyOn(Date, 'now').mockReturnValue(session.expiresAt.getTime() + 1)

		const result = await adapter.validateSession(session.id)
		expect(result.session).toBeNull()
		const internals = adapter as unknown as CookieSessionAdapterInternals
		expect(internals._sessions.has(session.id)).toBe(false)
	})

	it('sets session cookie with expected attributes', async () => {
		const adapter = new CookieSessionAdapter({ cookieName: 'auth', secureCookies: false })
		const cookies = createCookies()
		const session = await adapter.createSession('u1')
		adapter.setSessionCookie(cookies, session)

		const entry = cookies._store.get('auth')
		expect(entry).toBeTruthy()
		expect(entry?.options.httpOnly).toBe(true)
		expect(entry?.options.secure).toBe(false)
		expect(entry?.options.sameSite).toBe('lax')
	})

	it('lists sessions for a user', async () => {
		const adapter = new CookieSessionAdapter()
		await adapter.createSession('u1')
		await adapter.createSession('u2')
		const sessions = await adapter.listSessions('u1')
		expect(sessions).toHaveLength(1)
		if (!sessions[0]) throw new Error('Missing session')
		expect(sessions[0].userId).toBe('u1')
	})
})
