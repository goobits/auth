import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { RequestEventLike } from '../src/types/auth.ts'
import type {
	OAuthFlowIntent,
	OAuthProfile,
	OAuthTokens,
	Session,
	User
} from '../src/types/index.ts'
import type { OAuthFlowContext } from '../src/utils/oauth.ts'
import { MemoryUserAdapter, MockSessionAdapter, MockTokenAdapter } from '../src/testing/index.ts'

type OAuthCallback = (
	event: RequestEventLike,
	profile: OAuthProfile,
	tokens: OAuthTokens,
	context: OAuthFlowContext
) => Promise<string | void>

let capturedOnAuthenticated: OAuthCallback | undefined

vi.mock('../src/handlers/callback.ts', () => ({
	createCallbackHandler: (config: { onAuthenticated: OAuthCallback }) => {
		capturedOnAuthenticated = config.onAuthenticated
		return vi.fn(async () => new Response('ok'))
	}
}))

import { createAuth } from '../src/createAuth.ts'

const profile: OAuthProfile = {
	id: 'google-subject',
	email: 'member@example.com',
	name: 'Member',
	verified_email: true
}

const tokens: OAuthTokens = {
	accessToken: 'access-token',
	refreshToken: 'refresh-token',
	scope: 'openid email',
	accessTokenExpiresAt: '2099-01-01T00:00:00.000Z'
}

function createProvider() {
	return {
		createAuthorizationURL: () => new URL('https://example.com/auth'),
		getUserProfile: vi.fn(async () => ({ profile, tokens })),
		refreshAccessToken: vi.fn(),
		revokeTokens: vi.fn()
	}
}

function createEvent({
	user = null,
	session = null
}: { user?: User | null; session?: Session | null } = {}): RequestEventLike {
	return {
		request: new Request('http://localhost/auth/callback/google'),
		cookies: {
			get: vi.fn(),
			set: vi.fn(),
			delete: vi.fn(),
			getAll: vi.fn(() => []),
			serialize: vi.fn()
		},
		params: { provider: 'google' },
		locals: { user, session },
		url: new URL('http://localhost/auth/callback/google')
	}
}

function callback(): OAuthCallback {
	if (!capturedOnAuthenticated) throw new Error('Missing callback hook')
	return capturedOnAuthenticated
}

function context(intent: OAuthFlowIntent, userId: string | null = null): OAuthFlowContext {
	return { intent, userId, redirectTo: '/settings/security' }
}

async function createUser(adapter: MemoryUserAdapter, id: string, email = 'member@example.com') {
	return adapter.createUser({ id, email, name: 'Member', verified_email: true })
}

describe('createAuth OAuth lifecycle', () => {
	beforeEach(() => {
		capturedOnAuthenticated = undefined
	})

	it('signs in through an identity owned by the stable provider subject', async () => {
		const session = new MockSessionAdapter()
		const createSession = vi.spyOn(session, 'createSession')
		const identity = new MemoryUserAdapter()
		const user = await createUser(identity, 'existing-user')
		await identity.linkIdentity({ userId: user.id, provider: 'google', subject: profile.id })
		const onAuthentication = vi.fn()

		createAuth({
			adapters: { session, user: identity, oauthIdentity: identity },
			providers: { google: { provider: createProvider() } },
			hooks: { onAuthentication }
		})

		await callback()(createEvent(), profile, tokens, context('sign-in'))

		expect(onAuthentication).toHaveBeenCalledWith(
			expect.objectContaining({
				method: expect.objectContaining({
					kind: 'oauth',
					intent: 'sign-in',
					provider: 'google'
				}),
				user: expect.objectContaining({ id: user.id })
			})
		)
		expect(createSession).toHaveBeenCalledWith(user.id)
	})

	it('links an unknown subject only after the application resolves a real user', async () => {
		const session = new MockSessionAdapter()
		const identity = new MemoryUserAdapter()
		const user = await createUser(identity, 'resolved-user')

		createAuth({
			adapters: { session, user: identity, oauthIdentity: identity },
			providers: { google: { provider: createProvider() } },
			hooks: { onAuthentication: async () => ({ userId: user.id }) }
		})

		await callback()(createEvent(), profile, tokens, context('sign-in'))

		await expect(identity.getIdentity('google', profile.id)).resolves.toEqual({
			userId: user.id,
			provider: 'google',
			subject: profile.id
		})
	})

	it('returns an application pending route without creating identity or session state', async () => {
		const session = new MockSessionAdapter()
		const createSession = vi.spyOn(session, 'createSession')
		const identity = new MemoryUserAdapter()

		createAuth({
			adapters: { session, user: identity, oauthIdentity: identity },
			providers: { google: { provider: createProvider() } },
			hooks: { onAuthentication: async () => ({ redirectTo: '/finish-signup' }) }
		})

		await expect(callback()(createEvent(), profile, tokens, context('sign-in'))).resolves.toBe(
			'/finish-signup'
		)
		await expect(identity.getIdentity('google', profile.id)).resolves.toBeNull()
		expect(createSession).not.toHaveBeenCalled()
	})

	it('rejects an unsafe application pending redirect', async () => {
		const session = new MockSessionAdapter()
		const identity = new MemoryUserAdapter()

		createAuth({
			adapters: { session, user: identity, oauthIdentity: identity },
			providers: { google: { provider: createProvider() } },
			hooks: { onAuthentication: async () => ({ redirectTo: 'https://attacker.example' }) }
		})

		await expect(callback()(createEvent(), profile, tokens, context('sign-in'))).rejects.toThrow(
			'Invalid authentication redirect'
		)
	})

	it('rejects a provider subject whose surrounding whitespace would change identity ownership', async () => {
		const session = new MockSessionAdapter()
		const identity = new MemoryUserAdapter()
		const onAuthentication = vi.fn()

		createAuth({
			adapters: { session, user: identity, oauthIdentity: identity },
			providers: { google: { provider: createProvider() } },
			hooks: { onAuthentication }
		})

		await expect(
			callback()(createEvent(), { ...profile, id: ` ${profile.id} ` }, tokens, context('sign-in'))
		).rejects.toThrow('Invalid provider subject')
		expect(onAuthentication).not.toHaveBeenCalled()
	})

	it('never infers identity ownership from a matching provider email', async () => {
		const session = new MockSessionAdapter()
		const createSession = vi.spyOn(session, 'createSession')
		const identity = new MemoryUserAdapter()
		await createUser(identity, 'email-owner', profile.email)

		createAuth({
			adapters: { session, user: identity, oauthIdentity: identity },
			providers: { google: { provider: createProvider() } }
		})

		await expect(callback()(createEvent(), profile, tokens, context('sign-in'))).rejects.toThrow(
			'Unable to resolve authenticated principal'
		)
		await expect(identity.getIdentity('google', profile.id)).resolves.toBeNull()
		expect(createSession).not.toHaveBeenCalled()
	})

	it('fails closed when provider identity persistence is unavailable', async () => {
		const session = new MockSessionAdapter()
		const identity = new MemoryUserAdapter()
		vi.spyOn(identity, 'getIdentity').mockRejectedValue(new Error('database unavailable'))
		const createUserSpy = vi.spyOn(identity, 'createUser')

		createAuth({
			adapters: { session, user: identity, oauthIdentity: identity },
			providers: { google: { provider: createProvider() } }
		})

		await expect(callback()(createEvent(), profile, tokens, context('sign-in'))).rejects.toThrow(
			'database unavailable'
		)
		expect(createUserSpy).not.toHaveBeenCalled()
	})

	it('links a provider only to the current session principal after fresh authorization', async () => {
		const sessionAdapter = new MockSessionAdapter()
		const createSessionSpy = vi.spyOn(sessionAdapter, 'createSession')
		const identity = new MemoryUserAdapter()
		const user = await createUser(identity, 'current-user')
		const session: Session = {
			id: 'current-session',
			userId: user.id,
			expiresAt: new Date('2099-01-01T00:00:00.000Z')
		}
		const authorizeIdentityChange = vi.fn(async () => true)
		const onLinked = vi.fn()

		createAuth({
			adapters: { session: sessionAdapter, user: identity, oauthIdentity: identity },
			providers: { google: { provider: createProvider() } },
			oauth: { authorizeIdentityChange, hooks: { onLinked } }
		})

		await callback()(createEvent({ user, session }), profile, tokens, context('link', user.id))

		expect(authorizeIdentityChange).toHaveBeenCalledWith(
			expect.objectContaining({ action: 'oauth.link', userId: user.id, provider: 'google' })
		)
		await expect(identity.getIdentity('google', profile.id)).resolves.toMatchObject({
			userId: user.id
		})
		expect(onLinked).toHaveBeenCalledWith(
			expect.objectContaining({ userId: user.id, provider: 'google', subject: profile.id })
		)
		expect(createSessionSpy).not.toHaveBeenCalled()
	})

	it('rejects linking a provider identity owned by another user', async () => {
		const sessionAdapter = new MockSessionAdapter()
		const identity = new MemoryUserAdapter()
		const currentUser = await createUser(identity, 'current-user')
		const otherUser = await createUser(identity, 'other-user', 'other@example.com')
		await identity.linkIdentity({
			userId: otherUser.id,
			provider: 'google',
			subject: profile.id
		})
		const session: Session = {
			id: 'current-session',
			userId: currentUser.id,
			expiresAt: new Date('2099-01-01T00:00:00.000Z')
		}

		createAuth({
			adapters: { session: sessionAdapter, user: identity, oauthIdentity: identity },
			providers: { google: { provider: createProvider() } },
			oauth: { authorizeIdentityChange: async () => true }
		})

		await expect(
			callback()(
				createEvent({ user: currentUser, session }),
				profile,
				tokens,
				context('link', currentUser.id)
			)
		).rejects.toThrow('another account')
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
		const identity = new MemoryUserAdapter()
		const user = await createUser(identity, 'resolved-user')

		createAuth({
			adapters: { session, user: identity, oauthIdentity: identity, oauthToken },
			providers: { google: { provider: createProvider() } },
			hooks: { onAuthentication: async () => ({ userId: user.id }) }
		})

		await callback()(createEvent(), profile, tokens, context('sign-in'))
		expect(order).toEqual(['tokens', 'session'])
	})

	it('reauthenticates only through an identity already owned by the current user', async () => {
		const sessionAdapter = new MockSessionAdapter()
		const createSessionSpy = vi.spyOn(sessionAdapter, 'createSession')
		const invalidateSessionSpy = vi.spyOn(sessionAdapter, 'invalidateSession')
		const setSessionCookieSpy = vi.spyOn(sessionAdapter, 'setSessionCookie')
		const identity = new MemoryUserAdapter()
		const user = await createUser(identity, 'current-user')
		await identity.linkIdentity({ userId: user.id, provider: 'google', subject: profile.id })
		const session: Session = {
			id: 'current-session',
			userId: user.id,
			expiresAt: new Date('2099-01-01T00:00:00.000Z'),
			createdAt: new Date('2026-01-01T00:00:00.000Z'),
			mfaVerifiedAt: new Date('2026-01-02T00:00:00.000Z')
		}

		createAuth({
			adapters: { session: sessionAdapter, user: identity, oauthIdentity: identity },
			providers: { google: { provider: createProvider() } }
		})

		await callback()(createEvent({ user, session }), profile, tokens, context('reauth', user.id))

		expect(createSessionSpy).toHaveBeenCalledWith(
			user.id,
			expect.objectContaining({
				createdAt: expect.any(Date),
				mfaVerifiedAt: session.mfaVerifiedAt
			})
		)
		expect(invalidateSessionSpy).toHaveBeenCalledWith(session.id)
		expect(setSessionCookieSpy).toHaveBeenCalled()
	})
})
