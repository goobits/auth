import { describe, expect, it, vi } from 'vitest'

import type { SessionAdapter } from '../src/adapters/session/SessionAdapter.ts'
import { GoobitsAuth } from '../src/GoobitsAuth.ts'
import type { OAuthProvider } from '../src/providers/OAuthProvider.ts'
import type { Session, User } from '../src/types/index.ts'
import { createRequestEvent } from './testKit.ts'

function createProvider(): OAuthProvider {
	return {
		createAuthorizationURL: () => new URL('https://provider.example/auth'),
		getUserProfile: vi.fn(async () => ({
			profile: { id: 'p1', email: 'p1@example.com' },
			tokens: {
				accessToken: 'token',
				refreshToken: null,
				scope: null,
				accessTokenExpiresAt: new Date().toISOString()
			}
		}))
	}
}

function createSessionAdapter(validateResult: {
	session: Session | null
	user: User | null
}): SessionAdapter {
	return {
		cookieName: 'session',
		createSession: vi.fn(async (userId: string) => ({
			id: `s:${userId}`,
			userId,
			expiresAt: new Date(Date.now() + 60_000)
		})),
		validateSession: vi.fn(async () => validateResult),
		invalidateSession: vi.fn(async () => {}),
		invalidateUserSessions: vi.fn(async () => {}),
		setSessionCookie: vi.fn(),
		deleteSessionCookie: vi.fn()
	}
}

describe('GoobitsAuth', () => {
	it('exposes named route factories from the core auth instance', () => {
		const auth = new GoobitsAuth({
			adapter: { session: createSessionAdapter({ session: null, user: null }) }
		})

		expect(auth.routes.logout().POST).toBeTypeOf('function')
		expect(() => auth.routes.login()).toThrow(/not configured/)
	})

	it('populates event.locals.auth via handle()', async () => {
		const user: User = {
			id: 'u1',
			email: 'u1@example.com',
			name: 'User One',
			avatar: null,
			emailVerified: true,
			role: 'admin'
		}
		const session: Session = {
			id: 's1',
			userId: 'u1',
			expiresAt: new Date(Date.now() + 60_000)
		}
		const auth = new GoobitsAuth({
			adapter: { session: createSessionAdapter({ session, user }) },
			providers: { google: { provider: createProvider() } }
		})
		const event = createRequestEvent({ url: 'http://localhost/account' })
		event.cookies.set('session', 's1')

		const handle = auth.handle()
		await handle({
			event: event as never,
			resolve: async () => new Response('ok')
		} as never)

		expect(event.locals.user?.id).toBe('u1')
		expect((event.locals as { auth?: { user: User } | null }).auth?.user.id).toBe('u1')
	})

	it('dispatches /auth/signin/:provider via handlers', async () => {
		const auth = new GoobitsAuth({
			adapter: {
				session: createSessionAdapter({ session: null, user: null })
			},
			providers: { google: { provider: createProvider() } }
		})

		const event = createRequestEvent({
			url: 'http://localhost/auth/signin/google',
			params: { provider: 'google' }
		})
		await expect(auth.handlers.GET(event as never)).rejects.toMatchObject({
			status: 302,
			location: 'https://provider.example/auth'
		})
	})

	it('dispatches POST /auth/callback/:provider via handlers', async () => {
		const auth = new GoobitsAuth({
			adapter: {
				session: createSessionAdapter({ session: null, user: null })
			},
			providers: { apple: { provider: createProvider() } }
		})

		const event = createRequestEvent({
			url: 'http://localhost/auth/callback/apple',
			method: 'POST',
			form: { code: 'test-code', state: 'test-state' },
			params: { provider: 'apple' }
		})

		await expect(auth.handlers.POST(event as never)).rejects.not.toMatchObject({
			status: 404
		})
	})

	it('enforces requireAuthRole', async () => {
		const user: User = {
			id: 'u2',
			email: 'u2@example.com',
			name: 'User Two',
			avatar: null,
			emailVerified: true,
			role: 'member'
		}
		const session: Session = {
			id: 's2',
			userId: 'u2',
			expiresAt: new Date(Date.now() + 60_000)
		}
		const auth = new GoobitsAuth({
			adapter: { session: createSessionAdapter({ session, user }) }
		})
		const event = createRequestEvent({ url: 'http://localhost/protected' })
		event.locals.session = session
		event.locals.user = user
		await expect(auth.requireAuthRole(event, 'admin')).rejects.toMatchObject({ status: 403 })
	})

	it('never infers trusted roles from user-controlled settings', async () => {
		const user: User = {
			id: 'u3',
			email: 'u3@example.com',
			name: 'User Three',
			avatar: null,
			emailVerified: true,
			settings: { roles: ['admin'] }
		}
		const session: Session = {
			id: 's3',
			userId: user.id,
			expiresAt: new Date(Date.now() + 60_000)
		}
		const event = createRequestEvent({ url: 'http://localhost/protected' })
		event.locals.session = session
		event.locals.user = user

		const defaultAuth = new GoobitsAuth({
			adapter: { session: createSessionAdapter({ session, user }) }
		})
		await expect(defaultAuth.requireAuthRole(event, 'admin')).rejects.toMatchObject({ status: 403 })

		const resolvedAuth = new GoobitsAuth({
			adapter: { session: createSessionAdapter({ session, user }) },
			resolveAuthRoles: async (candidate) => (candidate.id === user.id ? ['admin'] : [])
		})
		await expect(resolvedAuth.requireAuthRole(event, 'admin')).resolves.toBe(user)
	})

	it('emits application-owned events through the configured security pipeline', async () => {
		const emitter = vi.fn()
		const auth = new GoobitsAuth({
			adapter: { session: createSessionAdapter({ session: null, user: null }) },
			security: {
				audit: { emitter },
				alerts: { enabled: false }
			}
		})

		await auth.emitSecurityEvent({
			name: 'auth.failure',
			severity: 'warn',
			route: '/login',
			method: 'POST',
			status: 401,
			message: 'Invalid credentials',
			ip: '192.0.2.10'
		})

		expect(emitter).toHaveBeenCalledWith({
			name: 'auth.failure',
			severity: 'warn',
			route: '/login',
			method: 'POST',
			status: 401,
			message: 'Invalid credentials',
			ip: '192.0.2.10',
			timestamp: expect.any(String)
		})
	})
})
