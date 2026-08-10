import { describe, expect, it, vi } from 'vitest'

import type { AuthSession, User } from '../src/types/index.ts'
import { createSessionAdapter, GoobitsAuth } from './_goobitsAuthTestKit.ts'
import { createRequestEvent } from './testKit.ts'

describe('GoobitsAuth session and authorization', () => {
	it('caches resolved sessions on request locals', async () => {
		const user: User = {
			id: 'u-cache',
			email: 'cache@example.com',
			name: 'Cached User',
			avatar: null,
			emailVerified: true
		}
		const session: AuthSession = {
			id: 's-cache',
			userId: user.id,
			expiresAt: new Date(Date.now() + 60_000)
		}
		const adapter = createSessionAdapter({ session, user })
		const auth = new GoobitsAuth({ adapter: { session: adapter } })
		const event = createRequestEvent({ url: 'http://localhost/account' })
		event.cookies.set('session', session.id)

		await expect(auth.getSession(event)).resolves.toEqual({ session, user })
		await expect(auth.getSession(event)).resolves.toEqual({ session, user })
		expect(adapter.validateSession).toHaveBeenCalledOnce()
		expect(adapter.validateSession).toHaveBeenCalledWith(session.id)
	})

	it('resolves configured roles and audits denied authorization', async () => {
		const user: User = {
			id: 'u2',
			email: 'u2@example.com',
			name: 'User Two',
			avatar: null,
			emailVerified: true,
			role: 'member',
			settings: { roles: ['editor', 'member', 123] }
		}
		const session: AuthSession = {
			id: 's2',
			userId: 'u2',
			expiresAt: new Date(Date.now() + 60_000)
		}
		const emitter = vi.fn()
		const auth = new GoobitsAuth({
			adapter: { session: createSessionAdapter({ session, user }) },
			resolveAuthRoles: async () => ['member', 'editor'],
			security: { audit: { emitter }, alerts: { enabled: false } }
		})
		const event = createRequestEvent({ url: 'http://localhost/protected' })
		event.locals.session = session
		event.locals.user = user

		await expect(auth.requireAuthRole(event, ['admin', 'editor'])).resolves.toBe(user)
		await expect(auth.requireAuthRole(event, 'admin')).rejects.toMatchObject({ status: 403 })
		expect(emitter).toHaveBeenCalledWith({
			name: 'authz.denied',
			severity: 'warn',
			route: '/protected',
			method: 'GET',
			status: 403,
			message: 'Missing required auth role',
			userId: user.id,
			details: {
				requiredAuthRoles: ['admin'],
				actorAuthRoles: ['member', 'editor']
			},
			timestamp: expect.any(String)
		})
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
		const session: AuthSession = {
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
