import { vi } from 'vitest'
import { createAuth as createAuthCore } from '../src/createAuth.ts'
import type { AuthConfig, RequestEventLike } from '../src/types/auth.ts'
import type {
	OAuthFlowIntent,
	OAuthProfile,
	OAuthTokens,
	AuthSession,
	User
} from '../src/types/index.ts'
import type { OAuthFlowContext } from '../src/utils/oauth.ts'
import { MemoryUserAdapter } from '../src/testing/index.ts'
import { TEST_CSRF_SECRET } from './testKit.ts'

export const profile: OAuthProfile = {
	id: 'google-subject',
	email: 'member@example.com',
	name: 'Member',
	verified_email: true
}

export const tokens: OAuthTokens = {
	accessToken: 'access-token',
	refreshToken: 'refresh-token',
	scope: 'openid email',
	accessTokenExpiresAt: '2099-01-01T00:00:00.000Z'
}

export function createProvider() {
	return {
		name: 'google',
		callbackMode: 'query' as const,
		createAuthorizationURL: () => new URL('https://example.com/auth'),
		getUserProfile: vi.fn(async () => ({ profile, tokens })),
		refreshAccessToken: vi.fn(),
		revokeTokens: vi.fn()
	}
}

export function createEvent({
	user = null,
	session = null
}: { user?: User | null; session?: AuthSession | null } = {}): RequestEventLike {
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

export function context(intent: OAuthFlowIntent, userId: string | null = null): OAuthFlowContext {
	return { intent, userId, redirectTo: '/settings/security' }
}

export const createUser = (adapter: MemoryUserAdapter, id: string, email = 'member@example.com') =>
	adapter.createUser({ id, email, name: 'Member', verified_email: true })

export function createAuth(config: AuthConfig) {
	return createAuthCore({
		...config,
		security: {
			...config.security,
			csrf: { secret: TEST_CSRF_SECRET, ...config.security?.csrf }
		}
	})
}
