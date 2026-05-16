import { encodeBase64url } from '@oslojs/encoding'
import type { Cookies } from '@sveltejs/kit'

import type { OAuthProfile, OAuthTokens, Session, User } from '../../types/index.js'
import { UserAdapter } from '../database/base.js'
import { TokenAdapter } from '../oauth-token/base.js'
import { SessionAdapter } from '../session/base.js'

type StoredUser = User & { password?: string | null }

export class MemoryUserAdapter extends UserAdapter {
	#oauthIndex = new Map<string, string>()
	#users = new Map<string, StoredUser>()

	async createUser(profile: OAuthProfile, metadata: Record<string, unknown> = {}): Promise<User> {
		const email = profile.email.trim().toLowerCase()
		const id = stringValue(metadata['id']) || stringValue(profile.id) || crypto.randomUUID()
		const role = stringValue(metadata['role'])
		const user: StoredUser = {
			avatar: profile.picture ?? null,
			createdAt: new Date(),
			email,
			emailVerified: Boolean(profile.verified_email),
			id,
			name: stringValue(metadata['name']) || profile.name || email,
			password: stringValue(metadata['password']) ?? null,
			settings: recordValue(metadata['settings']) ?? {},
			updatedAt: new Date()
		}
		if (role) {
			user.role = role
		}
		this.#users.set(id, user)
		return sanitizeUser(user) ?? user
	}

	async getUserById(id: string): Promise<User | null> {
		return sanitizeUser(this.#users.get(id) ?? null)
	}

	setUser(user: StoredUser): void {
		this.#users.set(user.id, user)
	}

	async getUserByEmail(email: string): Promise<User | null> {
		const normalized = email.trim().toLowerCase()
		for (const user of this.#users.values()) {
			if (user.email === normalized) {
				return sanitizeUser(user)
			}
		}
		return null
	}

	async getUserByProviderId(provider: string, providerId: string): Promise<User | null> {
		const userId = this.#oauthIndex.get(`${ provider }:${ providerId }`)
		return userId ? this.getUserById(userId) : null
	}

	async updateUser(id: string, data: Partial<User> & Record<string, unknown>): Promise<User> {
		const existing = this.#users.get(id)
		if (!existing) {
			throw new Error('User not found')
		}
		const next = {
			...existing,
			...data,
			updatedAt: new Date()
		}
		this.#users.set(id, next)
		return sanitizeUser(next) ?? next
	}

	async deleteUser(id: string): Promise<void> {
		this.#users.delete(id)
	}

	async linkOAuthAccount(userId: string, provider: string, providerAccountId: string): Promise<void> {
		this.#oauthIndex.set(`${ provider }:${ providerAccountId }`, userId)
	}

	async getUserWithPasswordHash(email: string): Promise<(User & { password?: string | null }) | null> {
		const normalized = email.trim().toLowerCase()
		for (const user of this.#users.values()) {
			if (user.email === normalized) {
				return user
			}
		}
		return null
	}
}

export class MemorySessionAdapter extends SessionAdapter {
	#cookieDomain: string | undefined
	#cookieName: string
	#secureCookies: boolean
	#sessionLifetimeMs: number
	#sessions = new Map<string, Session>()
	#users: MemoryUserAdapter

	constructor({
		cookieDomain,
		cookieName,
		secureCookies,
		sessionLifetimeMs = 30 * 24 * 60 * 60 * 1000,
		users
	}: {
		cookieDomain?: string;
		cookieName: string;
		secureCookies: boolean;
		sessionLifetimeMs?: number;
		users: MemoryUserAdapter;
	}) {
		super()
		this.#cookieDomain = cookieDomain
		this.#cookieName = cookieName
		this.#secureCookies = secureCookies
		this.#sessionLifetimeMs = sessionLifetimeMs
		this.#users = users
	}

	get cookieName(): string {
		return this.#cookieName
	}

	async createSession(userId: string, metadata: Record<string, unknown> = {}): Promise<Session> {
		const session: Session = {
			expiresAt: new Date(Date.now() + this.#sessionLifetimeMs),
			fingerprint: stringValue(metadata['fingerprint']) ?? null,
			id: randomSessionId(),
			ip: stringValue(metadata['ip']) ?? null,
			userAgent: stringValue(metadata['userAgent']) ?? null,
			userId
		}
		this.#sessions.set(session.id, session)
		return session
	}

	async validateSession(sessionId: string): Promise<{ session: Session | null; user: User | null }> {
		const session = this.#sessions.get(sessionId)
		if (!session) {
			return { session: null, user: null }
		}
		if (session.expiresAt.getTime() <= Date.now()) {
			this.#sessions.delete(sessionId)
			return { session: null, user: null }
		}
		return {
			session,
			user: await this.#users.getUserById(session.userId)
		}
	}

	async invalidateSession(sessionId: string): Promise<void> {
		this.#sessions.delete(sessionId)
	}

	async invalidateUserSessions(userId: string): Promise<void> {
		for (const [ id, session ] of this.#sessions.entries()) {
			if (session.userId === userId) {
				this.#sessions.delete(id)
			}
		}
	}

	async listSessions(userId: string): Promise<Session[]> {
		return [ ...this.#sessions.values() ].filter(session => session.userId === userId)
	}

	setSessionCookie(cookies: Cookies, session: Session): void {
		cookies.set(this.#cookieName, session.id, {
			...(this.#cookieDomain ? { domain: this.#cookieDomain } : {}),
			expires: session.expiresAt,
			httpOnly: true,
			path: '/',
			sameSite: 'lax',
			secure: this.#secureCookies
		})
	}

	deleteSessionCookie(cookies: Cookies): void {
		cookies.delete(this.#cookieName, {
			...(this.#cookieDomain ? { domain: this.#cookieDomain } : {}),
			path: '/'
		})
	}
}

export function createMemoryAuthAdapters(input: {
	cookieDomain?: string;
	cookieName: string;
	secureCookies: boolean;
}) {
	const user = new MemoryUserAdapter()
	return {
		session: new MemorySessionAdapter({
			...(input.cookieDomain ? { cookieDomain: input.cookieDomain } : {}),
			cookieName: input.cookieName,
			secureCookies: input.secureCookies,
			users: user
		}),
		user
	}
}

export class MockUserAdapter extends MemoryUserAdapter {}

export class MockSessionAdapter extends MemorySessionAdapter {
	#users: MemoryUserAdapter

	constructor() {
		const users = new MemoryUserAdapter()
		super({
			cookieName: 'session',
			secureCookies: false,
			users
		})
		this.#users = users
	}

	setUser(user: User): void {
		this.#users.setUser(user)
	}

	setSessionCookie(_cookies: Cookies, _session: Session): void {}
	deleteSessionCookie(_cookies: Cookies): void {}
}

export class MockTokenAdapter extends TokenAdapter {
	#tokens = new Map<string, OAuthTokens>()

	async storeTokens(userId: string, provider: string, tokens: OAuthTokens): Promise<void> {
		this.#tokens.set(`${ userId }:${ provider }`, tokens)
	}

	async getTokens(userId: string, provider: string): Promise<OAuthTokens | null> {
		return this.#tokens.get(`${ userId }:${ provider }`) ?? null
	}

	async refreshTokens(userId: string, provider: string): Promise<OAuthTokens | null> {
		return this.getTokens(userId, provider)
	}

	async deleteTokens(userId: string, provider: string): Promise<void> {
		this.#tokens.delete(`${ userId }:${ provider }`)
	}
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined
}

function sanitizeUser(user: StoredUser | null): User | null {
	if (!user) {
		return null
	}
	const { password: _password, ...safeUser } = user
	return safeUser
}

function stringValue(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function randomSessionId(): string {
	const bytes = new Uint8Array(24)
	crypto.getRandomValues(bytes)
	return encodeBase64url(bytes).replace(/=+$/g, '')
}
