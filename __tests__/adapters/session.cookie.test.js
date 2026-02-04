import { describe, it, expect, vi } from 'vitest'
import { CookieSessionAdapter } from '../../src/adapters/session/cookie.js'

function createCookies() {
	const store = new Map()
	return {
		set: (name, value, options) => store.set(name, { value, options }),
		get: (name) => store.get(name)?.value ?? null,
		delete: (name) => store.delete(name),
		_store: store
	}
}

describe('CookieSessionAdapter', () => {
	it('expires sessions and deletes them', async () => {
		const adapter = new CookieSessionAdapter({ sessionLifetime: 10 })
		const session = await adapter.createSession('u1')
		vi.spyOn(Date, 'now').mockReturnValue(session.expiresAt.getTime() + 1)

		const result = await adapter.validateSession(session.id)
		expect(result.session).toBeNull()
		expect(adapter._sessions.has(session.id)).toBe(false)
	})

	it('sets session cookie with expected attributes', async () => {
		const adapter = new CookieSessionAdapter({ cookieName: 'auth', secureCookies: false })
		const cookies = createCookies()
		const session = await adapter.createSession('u1')
		adapter.setSessionCookie(cookies, session)

		const entry = cookies._store.get('auth')
		expect(entry).toBeTruthy()
		expect(entry.options.httpOnly).toBe(true)
		expect(entry.options.secure).toBe(false)
		expect(entry.options.sameSite).toBe('lax')
	})

	it('lists sessions for a user', async () => {
		const adapter = new CookieSessionAdapter()
		await adapter.createSession('u1')
		await adapter.createSession('u2')
		const sessions = await adapter.listSessions('u1')
		expect(sessions).toHaveLength(1)
		expect(sessions[0].userId).toBe('u1')
	})
})
