import { describe, expect, it, vi } from 'vitest'

import type { SessionAdapter } from '../src/adapters/session/SessionAdapter.ts'
import { createAuth } from '../src/createAuth.ts'
import type { OAuthProvider } from '../src/providers/OAuthProvider.ts'
import type { RequestEventLike } from '../src/types/auth.ts'
import type { Session } from '../src/types/index.ts'
import { createRequestEvent } from './testKit.ts'

function createSessionAdapter({
	cookieName = 'session',
	validateResult = { session: null, user: null }
}: {
	cookieName?: string
	validateResult?: { session: Session | null; user: { id: string } | null }
} = {}): SessionAdapter {
	return {
		cookieName,
		validateSession: vi.fn(async () => validateResult),
		setSessionCookie: vi.fn(),
		deleteSessionCookie: vi.fn(),
		createSession: vi.fn(async (userId: string) => ({ id: `s:${userId}`, userId })),
		invalidateSession: vi.fn(async () => {}),
		invalidateUserSessions: vi.fn(async () => {}),
		listSessions: vi.fn(async () => [])
	}
}

function createProvider(): OAuthProvider {
	return {
		createAuthorizationURL: () => new URL('https://example.com/auth'),
		getUserProfile: vi.fn(async () => ({
			profile: { id: 'p1', email: 'p1@example.com' },
			tokens: { accessToken: 'token' }
		}))
	}
}

describe('createAuth', () => {
	it('throws when required config is missing', () => {
		expect(() => createAuth({ adapters: {}, providers: { google: { provider: {} } } })).toThrow(
			'createAuth requires adapters.session'
		)
	})

	it('allows auth without OAuth providers', () => {
		const auth = createAuth({ adapters: { session: createSessionAdapter() } })
		expect(auth.handlers.login).toBeUndefined()
		expect(auth.handlers.callback).toBeUndefined()
		expect(auth.routes.logout().POST).toBeDefined()
	})

	it('clears cookie when session is invalid', async () => {
		const sessionAdapter = createSessionAdapter({
			cookieName: 'auth_session',
			validateResult: { session: null, user: null }
		})
		const auth = createAuth({
			adapters: { session: sessionAdapter },
			providers: { google: { provider: createProvider() } }
		})

		const event = createRequestEvent()
		event.cookies.set('auth_session', 'deadbeef')

		await auth.handlers.hooks({
			event: event as RequestEventLike,
			resolve: (_e: RequestEventLike) => new Response('ok')
		})

		expect(sessionAdapter.validateSession).toHaveBeenCalledWith('deadbeef')
		expect(sessionAdapter.deleteSessionCookie).toHaveBeenCalledWith(event.cookies)
	})

	it('refreshes cookie when session is fresh', async () => {
		const session = { id: 's1', fresh: true }
		const user = { id: 'u1' }
		const sessionAdapter = createSessionAdapter({
			validateResult: { session, user }
		})

		const auth = createAuth({
			adapters: { session: sessionAdapter },
			providers: { google: { provider: createProvider() } }
		})

		const event = createRequestEvent()
		event.cookies.set('session', 's1')

		await auth.handlers.hooks({
			event: event as RequestEventLike,
			resolve: (_e: RequestEventLike) => new Response('ok')
		})

		expect(sessionAdapter.setSessionCookie).toHaveBeenCalledWith(event.cookies, session)
		expect(event.locals.user).toEqual(user)
	})

	it('converges concurrent refreshes on the same cookie without clearing either response', async () => {
		const currentSession = { id: 'current-session', fresh: true }
		const user = { id: 'u1' }
		const sessionAdapter = createSessionAdapter({
			validateResult: { session: currentSession, user }
		})
		const auth = createAuth({ adapters: { session: sessionAdapter } })
		const events = [createRequestEvent(), createRequestEvent()]
		for (const event of events) event.cookies.set('session', 'previous-session')

		await Promise.all(
			events.map((event) =>
				auth.handlers.hooks({
					event,
					resolve: (_event: RequestEventLike) => new Response('ok')
				})
			)
		)

		expect(sessionAdapter.validateSession).toHaveBeenCalledTimes(2)
		expect(sessionAdapter.validateSession).toHaveBeenNthCalledWith(1, 'previous-session')
		expect(sessionAdapter.validateSession).toHaveBeenNthCalledWith(2, 'previous-session')
		expect(sessionAdapter.setSessionCookie).toHaveBeenCalledTimes(2)
		for (const event of events) {
			expect(sessionAdapter.setSessionCookie).toHaveBeenCalledWith(event.cookies, currentSession)
		}
		expect(sessionAdapter.deleteSessionCookie).not.toHaveBeenCalled()
	})
})
