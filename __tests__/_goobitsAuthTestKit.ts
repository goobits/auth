import { vi } from 'vitest'

import type { SessionAdapter } from '../src/adapters/session/SessionAdapter.ts'
import { MemoryUserAdapter } from '../src/adapters/memory/user.ts'
import { GoobitsAuth as CoreGoobitsAuth, type GoobitsAuthConfig } from '../src/GoobitsAuth.ts'
import type { OAuthProvider } from '../src/providers/OAuthProvider.ts'
import type { AuthHandlers } from '../src/types/auth.ts'
import type { AuthSession, User } from '../src/types/index.ts'
import { TEST_CSRF_SECRET } from './testKit.ts'

export class GoobitsAuth extends CoreGoobitsAuth {
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

export function createProvider(): OAuthProvider {
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

export function createOAuthAdapters(session: SessionAdapter) {
	const identity = new MemoryUserAdapter()
	return { session, user: identity, oauthIdentity: identity }
}

export function createSessionAdapter(validateResult: {
	session: AuthSession | null
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

export function createRoutingHarness(basePath = '/auth') {
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
		currentSession: handler('session.current'),
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
