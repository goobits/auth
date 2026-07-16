import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { RequestEventLike } from '../src/types/auth.ts'
import type { OAuthProfile, OAuthTokens } from '../src/types/index.ts'
import { MockSessionAdapter, MockTokenAdapter, MockUserAdapter } from '../src/testing/index.ts'

let capturedOnAuthenticated:
	| ((event: RequestEventLike, profile: OAuthProfile, tokens: OAuthTokens) => Promise<void>)
	| undefined

vi.mock('../src/handlers/callback.ts', () => ({
	createCallbackHandler: (config: {
		onAuthenticated: (
			event: RequestEventLike,
			profile: OAuthProfile,
			tokens: OAuthTokens
		) => Promise<void>
	}) => {
		capturedOnAuthenticated = config.onAuthenticated
		return vi.fn(async () => new Response('ok'))
	}
}))

import { createAuth } from '../src/createAuth.ts'

function createProvider() {
	return {
		createAuthorizationURL: () => new URL('https://example.com/auth'),
		getUserProfile: vi.fn(async () => ({
			profile: { id: 'p1', email: 'p1@example.com' },
			tokens: { accessToken: 'token' }
		}))
	}
}

function createEvent(): RequestEventLike {
	return {
		request: new Request('http://localhost/auth/callback'),
		cookies: {
			get: vi.fn(),
			set: vi.fn(),
			delete: vi.fn(),
			getAll: vi.fn(() => []),
			serialize: vi.fn()
		},
		params: { provider: 'google' },
		locals: {},
		url: new URL('http://localhost/auth/callback')
	}
}

describe('createAuth OAuth lifecycle', () => {
	beforeEach(() => {
		capturedOnAuthenticated = undefined
	})

	it('creates a session when onLogin resolves a userId', async () => {
		const sessionAdapter = {
			createSession: vi.fn(async (userId: string) => ({ id: `s:${userId}`, userId })),
			setSessionCookie: vi.fn(),
			deleteSessionCookie: vi.fn(),
			validateSession: vi.fn(async () => ({ session: null, user: null })),
			invalidateSession: vi.fn(async () => {}),
			invalidateUserSessions: vi.fn(async () => {}),
			listSessions: vi.fn(async () => [])
		}

		createAuth({
			adapters: {
				session: sessionAdapter
			},
			providers: { google: { provider: createProvider() } },
			hooks: {
				onLogin: async () => ({ userId: 'hook-user' })
			}
		})

		if (!capturedOnAuthenticated) throw new Error('Missing callback hook')
		await capturedOnAuthenticated(
			createEvent(),
			{ id: 'google-id', email: 'user@example.com' },
			{ accessToken: 'token' }
		)

		expect(sessionAdapter.createSession).toHaveBeenCalledWith('hook-user')
		expect(sessionAdapter.setSessionCookie).toHaveBeenCalled()
	})

	it('fails when no principal can be resolved', async () => {
		const sessionAdapter = {
			createSession: vi.fn(async (userId: string) => ({ id: `s:${userId}`, userId })),
			setSessionCookie: vi.fn(),
			deleteSessionCookie: vi.fn(),
			validateSession: vi.fn(async () => ({ session: null, user: null })),
			invalidateSession: vi.fn(async () => {}),
			invalidateUserSessions: vi.fn(async () => {}),
			listSessions: vi.fn(async () => [])
		}

		createAuth({
			adapters: {
				session: sessionAdapter
			},
			providers: { google: { provider: createProvider() } },
			hooks: {
				onLogin: async () => undefined
			}
		})

		if (!capturedOnAuthenticated) throw new Error('Missing callback hook')
		await expect(
			capturedOnAuthenticated(
				createEvent(),
				{ id: 'google-id', email: 'user@example.com' },
				{ accessToken: 'token' }
			)
		).rejects.toThrow('Unable to resolve authenticated principal')
	})

	it('fails closed when provider identity lookup infrastructure errors', async () => {
		const session = new MockSessionAdapter()
		const user = new MockUserAdapter()
		vi.spyOn(user, 'getUserByProviderId').mockRejectedValue(new Error('database unavailable'))
		const createUser = vi.spyOn(user, 'createUser')
		createAuth({
			adapters: { session, user },
			providers: { google: { provider: createProvider() } }
		})

		if (!capturedOnAuthenticated) throw new Error('Missing callback hook')
		await expect(
			capturedOnAuthenticated(
				createEvent(),
				{ id: 'google-id', email: 'user@example.com', verified_email: true },
				{ accessToken: 'token' }
			)
		).rejects.toThrow('database unavailable')
		expect(createUser).not.toHaveBeenCalled()
	})

	it('never links an existing account from an unverified provider email claim', async () => {
		const session = new MockSessionAdapter()
		const user = new MockUserAdapter()
		await user.createUser({
			id: 'existing',
			email: 'user@example.com',
			verified_email: true
		})
		const link = vi.spyOn(user, 'linkOAuthAccount')
		createAuth({
			adapters: { session, user },
			providers: { google: { provider: createProvider() } }
		})

		if (!capturedOnAuthenticated) throw new Error('Missing callback hook')
		await expect(
			capturedOnAuthenticated(
				createEvent(),
				{ id: 'google-id', email: 'user@example.com', verified_email: false },
				{ accessToken: 'token' }
			)
		).rejects.toThrow('Provider must verify the email')
		expect(link).not.toHaveBeenCalled()
	})

	it('does not create a session when OAuth account linking fails', async () => {
		const session = new MockSessionAdapter()
		const createSession = vi.spyOn(session, 'createSession')
		const user = new MockUserAdapter()
		await user.createUser({
			id: 'existing',
			email: 'user@example.com',
			verified_email: true
		})
		vi.spyOn(user, 'linkOAuthAccount').mockRejectedValue(new Error('link conflict'))
		createAuth({
			adapters: { session, user },
			providers: { google: { provider: createProvider() } }
		})

		if (!capturedOnAuthenticated) throw new Error('Missing callback hook')
		await expect(
			capturedOnAuthenticated(
				createEvent(),
				{ id: 'google-id', email: 'user@example.com', verified_email: true },
				{ accessToken: 'token' }
			)
		).rejects.toThrow('link conflict')
		expect(createSession).not.toHaveBeenCalled()
	})

	it('persists provider tokens before exposing a new session', async () => {
		const order: string[] = []
		const session = new MockSessionAdapter()
		vi.spyOn(session, 'createSession').mockImplementation(async (userId) => {
			order.push('session')
			return { id: 'session-1', userId, expiresAt: new Date(Date.now() + 1000) }
		})
		const oauthToken = new MockTokenAdapter()
		vi.spyOn(oauthToken, 'storeTokens').mockImplementation(async () => {
			order.push('tokens')
		})
		createAuth({
			adapters: { session, oauthToken },
			providers: { google: { provider: createProvider() } },
			hooks: { onLogin: async () => ({ userId: 'hook-user' }) }
		})

		if (!capturedOnAuthenticated) throw new Error('Missing callback hook')
		await capturedOnAuthenticated(
			createEvent(),
			{ id: 'google-id', email: 'user@example.com', verified_email: true },
			{ accessToken: 'token' }
		)
		expect(order).toEqual(['tokens', 'session'])
	})
})
