import { UserAdapter } from '../adapters/database/UserAdapter.ts'
import type {
	PasswordCredential,
	PasswordCredentialAdapter
} from '../adapters/database/PasswordCredentialAdapter.ts'
import { TokenAdapter } from '../adapters/oauth-token/TokenAdapter.ts'
import { SessionAdapter } from '../adapters/session/SessionAdapter.ts'
import { generateSessionId } from '../adapters/session/sessionId.ts'
import type { OAuthProfile, OAuthTokens, Session, User } from '../types/index.ts'
import { assertPublicUserData } from '../adapters/database/publicUserData.ts'

export class MockSessionAdapter extends SessionAdapter {
	private sessions = new Map<string, Session>()
	private users = new Map<string, User>()

	setUser(user: User): void {
		this.users.set(String(user.id), user)
	}

	async createSession(userId: string): Promise<Session> {
		const session: Session = {
			id: `session:${generateSessionId()}`,
			userId,
			expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
		}
		this.sessions.set(session.id, session)
		return session
	}

	async validateSession(
		sessionId: string
	): Promise<{ session: Session | null; user: User | null }> {
		const session = this.sessions.get(sessionId) ?? null
		const user = session ? (this.users.get(session.userId) ?? null) : null
		return { session, user }
	}

	async invalidateSession(sessionId: string): Promise<void> {
		this.sessions.delete(sessionId)
	}

	async invalidateUserSessions(userId: string): Promise<void> {
		for (const [sessionId, session] of this.sessions.entries()) {
			if (session.userId === userId) this.sessions.delete(sessionId)
		}
	}

	async listSessions(userId: string): Promise<Session[]> {
		return [...this.sessions.values()].filter((session) => session.userId === userId)
	}

	setSessionCookie(): void {}
	deleteSessionCookie(): void {}
}

export class MockUserAdapter extends UserAdapter implements PasswordCredentialAdapter {
	private users = new Map<string, User & { password?: string | null }>()
	private oauthIndex = new Map<string, string>()

	async createUser(profile: OAuthProfile, metadata: Record<string, unknown> = {}): Promise<User> {
		assertPublicUserData(metadata)
		const id = String((metadata['id'] as string | undefined) ?? profile.id ?? profile.email)
		const user: User & { password?: string | null } = {
			id,
			email: profile.email,
			name: profile.name ?? profile.email,
			avatar: profile.picture ?? null,
			emailVerified: Boolean(profile.verified_email),
			password: null
		}
		this.users.set(id, user)
		return this.sanitize(user) ?? user
	}

	async createUserWithPassword(
		profile: OAuthProfile,
		passwordHash: string,
		metadata: Record<string, unknown> = {}
	): Promise<User> {
		if (!passwordHash) throw new Error('Password hash is required')
		if (await this.getUserByEmail(profile.email)) {
			throw new Error('Unable to create user with those details')
		}
		const user = await this.createUser(profile, metadata)
		const stored = this.users.get(user.id)
		if (!stored) throw new Error('Created user not found')
		stored.password = passwordHash
		return this.sanitize(stored) ?? stored
	}

	async getUserById(id: string): Promise<User | null> {
		const user = this.users.get(String(id)) ?? null
		return this.sanitize(user)
	}

	async getUserByEmail(email: string): Promise<User | null> {
		for (const user of this.users.values()) {
			if (user.email === email) return this.sanitize(user)
		}
		return null
	}

	async getUserByProviderId(provider: string, providerId: string): Promise<User | null> {
		const userId = this.oauthIndex.get(`${provider}:${providerId}`)
		if (!userId) return null
		return this.getUserById(userId)
	}

	async updateUser(id: string, data: Partial<User> & Record<string, unknown>): Promise<User> {
		assertPublicUserData(data)
		const user = this.users.get(String(id))
		if (!user) throw new Error('User not found')
		const next = { ...user, ...data }
		this.users.set(String(id), next)
		return this.sanitize(next) ?? next
	}

	async deleteUser(id: string): Promise<void> {
		this.users.delete(String(id))
	}

	async linkOAuthAccount(
		userId: string,
		provider: string,
		providerAccountId: string
	): Promise<void> {
		const key = `${provider}:${providerAccountId}`
		const owner = this.oauthIndex.get(key)
		if (owner && owner !== String(userId)) {
			throw new Error('OAuth provider account is already linked to another user')
		}
		this.oauthIndex.set(key, String(userId))
	}

	async findPasswordCredential(email: string, field = 'email'): Promise<PasswordCredential | null> {
		if (field !== 'email') return null
		for (const user of this.users.values()) {
			if (user.email === email) {
				return { user: this.sanitize(user) ?? user, passwordHash: user.password ?? null }
			}
		}
		return null
	}

	async updatePasswordHash(userId: string, passwordHash: string): Promise<User> {
		if (!passwordHash) throw new Error('Password hash is required')
		const user = this.users.get(userId)
		if (!user) throw new Error('User not found')
		user.password = passwordHash
		return this.sanitize(user) ?? user
	}

	private sanitize(user: (User & { password?: string | null }) | null): User | null {
		if (!user) return null
		const { password: _password, ...safe } = user
		return safe
	}
}

export class MockTokenAdapter extends TokenAdapter {
	private tokens = new Map<string, OAuthTokens>()

	async storeTokens(userId: string, provider: string, tokens: OAuthTokens): Promise<void> {
		this.tokens.set(`${userId}:${provider}`, tokens)
	}

	async getTokens(userId: string, provider: string): Promise<OAuthTokens | null> {
		return this.tokens.get(`${userId}:${provider}`) ?? null
	}

	async refreshTokens(userId: string, provider: string): Promise<OAuthTokens | null> {
		return this.getTokens(userId, provider)
	}

	async deleteTokens(userId: string, provider: string): Promise<void> {
		this.tokens.delete(`${userId}:${provider}`)
	}
}
