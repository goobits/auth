import { describe, expect, expectTypeOf, it, vi } from 'vitest'

import type { SessionAdapter } from '../src/adapters/session/SessionAdapter.ts'
import type { WebAuthnAdapter } from '../src/adapters/webauthn/WebAuthnAdapter.ts'
import { MemoryUserAdapter } from '../src/adapters/memory/user.ts'
import { GoobitsAuth as CoreGoobitsAuth, type GoobitsAuthConfig } from '../src/GoobitsAuth.ts'
import type { OAuthProvider } from '../src/providers/OAuthProvider.ts'
import type { AuthHandlers } from '../src/types/auth.ts'
import type { Session, User } from '../src/types/index.ts'
import { createRequestEvent, TEST_CSRF_SECRET } from './testKit.ts'

class GoobitsAuth extends CoreGoobitsAuth {
	constructor(config: GoobitsAuthConfig) {
		super({
			...config,
			security: {
				...config.security,
				csrf: { secret: TEST_CSRF_SECRET, ...config.security?.csrf }
			}
		} as GoobitsAuthConfig)
	}
}

function createProvider(): OAuthProvider {
	return {
		name: 'google',
		callbackMode: 'query',
		createAuthorizationURL: () => new URL('https://provider.example/auth'),
		getUserProfile: vi.fn(async () => ({
			profile: { id: 'p1', email: 'p1@example.com' },
			tokens: {
				accessToken: 'token',
				refreshToken: null,
				scope: null,
				accessTokenExpiresAt: new Date().toISOString()
			}
		})),
		refreshAccessToken: vi.fn(),
		revokeTokens: vi.fn()
	}
}

function createOAuthAdapters(session: SessionAdapter) {
	const identity = new MemoryUserAdapter()
	return { session, user: identity, oauthIdentity: identity }
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

function createRoutingHarness(basePath = '/auth') {
	const auth = new GoobitsAuth({
		adapter: { session: createSessionAdapter({ session: null, user: null }) },
		routing: { basePath }
	})
	const invocations: string[] = []
	const handler =
		(name: string): AuthHandlers['logout'] =>
		async () => {
			invocations.push(name)
			return new Response(name)
		}
	const handlers: AuthHandlers = {
		login: handler('login'),
		callback: handler('callback'),
		logout: handler('logout'),
		hooks: async ({ event, resolve }) => resolve(event),
		magicLink: {
			request: handler('magicLink.request'),
			verify: handler('magicLink.verify')
		},
		webauthn: {
			registerOptions: handler('webauthn.registerOptions'),
			registerVerify: handler('webauthn.registerVerify'),
			loginOptions: handler('webauthn.loginOptions'),
			loginVerify: handler('webauthn.loginVerify'),
			listCredentials: handler('webauthn.listCredentials'),
			removeCredential: handler('webauthn.removeCredential'),
			stepUpOptions: handler('webauthn.stepUpOptions'),
			stepUpVerify: handler('webauthn.stepUpVerify')
		},
		mfa: {
			status: handler('mfa.status'),
			enroll: handler('mfa.enroll'),
			verify: handler('mfa.verify'),
			disable: handler('mfa.disable'),
			backupCode: handler('mfa.backupCode'),
			stepUp: handler('mfa.stepUp')
		},
		sessions: {
			list: handler('sessions.list'),
			revoke: handler('sessions.revoke')
		},
		oauth: {
			identities: handler('oauth.identities'),
			unlink: handler('oauth.unlink')
		}
	}
	const core = Reflect.get(auth, 'core') as { handlers: AuthHandlers }
	core.handlers = handlers
	return { auth, invocations }
}

describe('GoobitsAuth', () => {
	it('rejects storage-only WebAuthn adapters at the facade and runtime boundaries', () => {
		const storageOnlyWebAuthn = {} as WebAuthnAdapter
		const invalidConfig = {
			adapter: {
				session: createSessionAdapter({ session: null, user: null }),
				webauthn: storageOnlyWebAuthn
			},
			webauthn: {
				authorizeSecurityChange: async () => true,
				origin: 'https://example.com',
				rpID: 'example.com',
				rpName: 'Example'
			}
		}

		expectTypeOf(invalidConfig).not.toMatchTypeOf<GoobitsAuthConfig>()
		expect(() => new GoobitsAuth(invalidConfig as never)).toThrow(
			'atomic createCredentialWithinLimit adapter capability'
		)
	})

	it('requires single-use verification-token storage when login MFA is enabled', () => {
		expect(
			() =>
				new GoobitsAuth({
					adapter: {
						session: createSessionAdapter({ session: null, user: null }),
						mfa: {}
					},
					mfa: {
						authorizeSecurityChange: async () => true,
						login: {}
					}
				} as never)
		).toThrow('mfa.login requires adapters.verificationToken')
	})

	it('exposes named route factories from the core auth instance', () => {
		const auth = new GoobitsAuth({
			adapter: { session: createSessionAdapter({ session: null, user: null }) }
		})

		expect(auth.routes.logout().POST).toBeTypeOf('function')
		expect(() => auth.routes.login()).toThrow(/not configured/)
	})

	it('exposes form actions separately from endpoint route factories', async () => {
		const auth = new GoobitsAuth({
			profile: 'basic',
			adapter: { session: createSessionAdapter({ session: null, user: null }) },
			security: {
				csrf: { mode: 'required' },
				rateLimit: { mode: 'off' },
				audit: { mode: 'off' }
			}
		})
		const event = createRequestEvent({
			url: 'http://localhost/sign-out',
			method: 'POST'
		})

		const result = await auth.actions.logout().default(event as never)

		expect(result).toMatchObject({
			status: 403,
			data: { ok: false, error: 'Invalid CSRF token' }
		})
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
			adapter: { session: createSessionAdapter({ session, user }) }
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
		const session = createSessionAdapter({ session: null, user: null })
		const auth = new GoobitsAuth({
			adapter: createOAuthAdapters(session),
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
		const session = createSessionAdapter({ session: null, user: null })
		const auth = new GoobitsAuth({
			adapter: createOAuthAdapters(session),
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

	it('enforces CSRF before unlinking an OAuth identity', async () => {
		const user: User = {
			id: 'u-oauth',
			email: 'oauth@example.com',
			name: 'OAuth User',
			avatar: null,
			emailVerified: true
		}
		const session: Session = {
			id: 's-oauth',
			userId: user.id,
			expiresAt: new Date(Date.now() + 60_000)
		}
		const adapters = createOAuthAdapters(createSessionAdapter({ session, user }))
		const authorizeIdentityChange = vi.fn(async () => true)
		const auth = new GoobitsAuth({
			profile: 'basic',
			adapter: adapters,
			providers: { google: { provider: createProvider() } },
			oauth: { authorizeIdentityChange },
			security: {
				csrf: { mode: 'required' },
				rateLimit: { mode: 'off' },
				audit: { mode: 'off' }
			}
		})
		const event = createRequestEvent({
			url: 'http://localhost/auth/oauth/unlink',
			method: 'POST',
			form: { provider: 'google' },
			locals: { session, user }
		})

		const response = await auth.handlers.POST(event as never)

		expect(response.status).toBe(403)
		await expect(response.json()).resolves.toEqual({
			ok: false,
			error: 'Invalid CSRF token'
		})
		expect(authorizeIdentityChange).not.toHaveBeenCalled()
	})

	it('dispatches root-mounted handlers when basePath is empty', async () => {
		const session: Session = {
			id: 's-root',
			userId: 'u-root',
			expiresAt: new Date(Date.now() + 60_000)
		}
		const sessionAdapter = createSessionAdapter({ session: null, user: null })
		const auth = new GoobitsAuth({
			profile: 'secure',
			adapter: { session: sessionAdapter },
			security: {
				requestOrigin: { mode: 'required', validate: async () => true },
				csrf: { mode: 'off' }
			}
		})
		const event = createRequestEvent({
			url: 'http://localhost/signout',
			method: 'POST'
		})
		event.locals.session = session

		await expect(auth.createHandlers({ basePath: '' }).POST(event as never)).rejects.toMatchObject({
			status: 302,
			location: '/'
		})
		expect(sessionAdapter.invalidateSession).toHaveBeenCalledWith(session.id)
	})

	it('dispatches every supported facade route to its direct handler', async () => {
		const { auth, invocations } = createRoutingHarness()
		const cases = [
			{ method: 'GET', path: '/auth/signin/google', handler: 'login', provider: 'google' },
			{ method: 'GET', path: '/auth/link/google', handler: 'login', provider: 'google' },
			{ method: 'GET', path: '/auth/reauth/apple', handler: 'login', provider: 'apple' },
			{
				method: 'POST',
				path: '/auth/callback/apple',
				handler: 'callback',
				provider: 'apple'
			},
			{ method: 'POST', path: '/auth/signout', handler: 'logout' },
			{ method: 'POST', path: '/auth/magic-link', handler: 'magicLink.request' },
			{ method: 'GET', path: '/auth/magic-link/verify', handler: 'magicLink.verify' },
			{ method: 'POST', path: '/auth/magic-link/verify', handler: 'magicLink.verify' },
			{
				method: 'POST',
				path: '/auth/passkey/register/options',
				handler: 'webauthn.registerOptions'
			},
			{
				method: 'POST',
				path: '/auth/passkey/register/verify',
				handler: 'webauthn.registerVerify'
			},
			{
				method: 'POST',
				path: '/auth/passkey/login/options',
				handler: 'webauthn.loginOptions'
			},
			{
				method: 'POST',
				path: '/auth/passkey/login/verify',
				handler: 'webauthn.loginVerify'
			},
			{
				method: 'GET',
				path: '/auth/passkey/credentials',
				handler: 'webauthn.listCredentials'
			},
			{
				method: 'POST',
				path: '/auth/passkey/credentials',
				handler: 'webauthn.removeCredential'
			},
			{
				method: 'POST',
				path: '/auth/passkey/step-up/options',
				handler: 'webauthn.stepUpOptions'
			},
			{
				method: 'POST',
				path: '/auth/passkey/step-up/verify',
				handler: 'webauthn.stepUpVerify'
			},
			{ method: 'GET', path: '/auth/mfa/status', handler: 'mfa.status' },
			{ method: 'POST', path: '/auth/mfa/enroll', handler: 'mfa.enroll' },
			{ method: 'POST', path: '/auth/mfa/verify', handler: 'mfa.verify' },
			{ method: 'POST', path: '/auth/mfa/disable', handler: 'mfa.disable' },
			{ method: 'POST', path: '/auth/mfa/backup-code', handler: 'mfa.backupCode' },
			{ method: 'POST', path: '/auth/mfa/step-up', handler: 'mfa.stepUp' },
			{ method: 'GET', path: '/auth/sessions', handler: 'sessions.list' },
			{ method: 'POST', path: '/auth/sessions', handler: 'sessions.revoke' },
			{ method: 'GET', path: '/auth/oauth/identities', handler: 'oauth.identities' },
			{ method: 'POST', path: '/auth/oauth/unlink', handler: 'oauth.unlink' }
		] as const

		for (const route of cases) {
			invocations.length = 0
			const event = createRequestEvent({
				url: `http://localhost${route.path}`,
				method: route.method
			})
			const response = await auth.handlers[route.method](event as never)

			expect(await response.text()).toBe(route.handler)
			expect(invocations).toEqual([route.handler])
			if ('provider' in route) expect(event.params['provider']).toBe(route.provider)
		}
	})

	it('enforces exact base paths, configured mounts, and allowed methods', async () => {
		const { auth, invocations } = createRoutingHarness('/account/auth/')
		const handlers = auth.createHandlers({ basePath: '/account/identity/' })
		const customEvent = createRequestEvent({
			url: 'http://localhost/account/identity/mfa/status'
		})
		const customResponse = await handlers.GET(customEvent as never)

		expect(await customResponse.text()).toBe('mfa.status')
		expect(invocations).toEqual(['mfa.status'])

		const cases = [
			{ method: 'GET', path: '/account/identity/signout', status: 405 },
			{ method: 'PUT', path: '/account/identity/mfa/status', status: 405 },
			{ method: 'GET', path: '/account/identity/unknown/path', status: 404 },
			{ method: 'GET', path: '/account/identityish', status: 404 }
		] as const
		for (const route of cases) {
			const event = createRequestEvent({
				url: `http://localhost${route.path}`,
				method: route.method
			})
			const response = await handlers.GET(event as never)
			expect(response.status).toBe(route.status)
		}

		const unconfigured = new GoobitsAuth({
			adapter: { session: createSessionAdapter({ session: null, user: null }) }
		})
		const missingEvent = createRequestEvent({ url: 'http://localhost/auth/mfa/status' })
		expect((await unconfigured.handlers.GET(missingEvent as never)).status).toBe(404)
		expect(() => auth.createHandlers({ basePath: 'account/identity' })).toThrow(
			'Invalid auth base path'
		)
		expect(() => auth.createHandlers({ basePath: '/account/../identity' })).toThrow(
			'Invalid auth base path'
		)
	})

	it('caches resolved sessions on request locals', async () => {
		const user: User = {
			id: 'u-cache',
			email: 'cache@example.com',
			name: 'Cached User',
			avatar: null,
			emailVerified: true
		}
		const session: Session = {
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
		const session: Session = {
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
