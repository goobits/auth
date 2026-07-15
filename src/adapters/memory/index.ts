import type { Cookies } from '@sveltejs/kit'

import type {
	MfaStatus,
	OAuthProfile,
	OAuthTokens,
	Session,
	User,
	WebAuthnCredential
} from '../../types/index.ts'
import { generateRandomUUID } from '../../utils/crypto.ts'
import { UserAdapter } from '../database/UserAdapter.ts'
import { MagicLinkAdapter } from '../magic-link/MagicLinkAdapter.ts'
import { MfaAdapter } from '../mfa/MfaAdapter.ts'
import { TokenAdapter } from '../oauth-token/TokenAdapter.ts'
import { SessionAdapter } from '../session/SessionAdapter.ts'
import { generateSessionId } from '../session/sessionId.ts'
import { WebAuthnAdapter } from '../webauthn/WebAuthnAdapter.ts'

type StoredUser = User & { password?: string | null }
type StoredMagicLinkToken = {
	id: string
	userId: string | null
	email: string
	tokenHash: string
	otpHash?: string | null
	expiresAt: Date
	metadata?: Record<string, unknown>
}

/** In-memory user adapter for local development and tests. */
export class MemoryUserAdapter extends UserAdapter {
	#oauthIndex = new Map<string, string>()
	#users = new Map<string, StoredUser>()

	async createUser(profile: OAuthProfile, metadata: Record<string, unknown> = {}): Promise<User> {
		const email = profile.email.trim().toLowerCase()
		const id =
			stringValue(metadata['id']) || stringValue(profile.id) || (await generateRandomUUID())
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
		const userId = this.#oauthIndex.get(`${provider}:${providerId}`)
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

	async linkOAuthAccount(
		userId: string,
		provider: string,
		providerAccountId: string
	): Promise<void> {
		this.#oauthIndex.set(`${provider}:${providerAccountId}`, userId)
	}

	async getUserWithPasswordHash(
		email: string
	): Promise<(User & { password?: string | null }) | null> {
		const normalized = email.trim().toLowerCase()
		for (const user of this.#users.values()) {
			if (user.email === normalized) {
				return user
			}
		}
		return null
	}
}

/** In-memory magic link adapter for local development and tests. */
export class MemoryMagicLinkAdapter extends MagicLinkAdapter {
	#counter = 0
	#tokens = new Map<string, StoredMagicLinkToken>()

	async createToken({
		userId,
		email,
		tokenHash,
		otpHash,
		expiresAt,
		metadata
	}: {
		userId: string | null
		email: string
		tokenHash: string
		otpHash?: string | null
		expiresAt: Date
		metadata?: Record<string, unknown>
	}): Promise<Record<string, unknown>> {
		const id = `magic-${++this.#counter}`
		const token: StoredMagicLinkToken = {
			id,
			userId,
			email,
			tokenHash,
			otpHash: otpHash ?? null,
			expiresAt,
			...(metadata ? { metadata } : {})
		}
		this.#tokens.set(id, token)
		return token
	}

	async findByTokenHash(tokenHash: string): Promise<Record<string, unknown> | null> {
		for (const token of this.#tokens.values()) {
			if (token.tokenHash === tokenHash) return token
		}
		return null
	}

	async findByEmailAndOtpHash({
		email,
		otpHash
	}: {
		email: string
		otpHash: string
	}): Promise<Record<string, unknown> | null> {
		for (const token of this.#tokens.values()) {
			if (token.email === email && token.otpHash === otpHash) return token
		}
		return null
	}

	async deleteById(tokenId: string): Promise<void> {
		this.#tokens.delete(tokenId)
	}

	async deleteByUserId(userId: string): Promise<void> {
		for (const [id, token] of this.#tokens.entries()) {
			if (token.userId === userId) this.#tokens.delete(id)
		}
	}

	async deleteByEmail(email: string): Promise<void> {
		for (const [id, token] of this.#tokens.entries()) {
			if (token.email === email) this.#tokens.delete(id)
		}
	}

	async consumeByTokenHash(tokenHash: string): Promise<Record<string, unknown> | null> {
		const token = await this.findByTokenHash(tokenHash)
		const id = typeof token?.['id'] === 'string' ? token['id'] : null
		if (id) this.#tokens.delete(id)
		return token
	}

	async consumeByEmailAndOtpHash(params: {
		email: string
		otpHash: string
	}): Promise<Record<string, unknown> | null> {
		const token = await this.findByEmailAndOtpHash(params)
		const id = typeof token?.['id'] === 'string' ? token['id'] : null
		if (id) this.#tokens.delete(id)
		return token
	}
}

/** In-memory session adapter with cookie helpers. */
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
		cookieDomain?: string
		cookieName: string
		secureCookies: boolean
		sessionLifetimeMs?: number
		users: MemoryUserAdapter
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
			id: generateSessionId(24),
			ip: stringValue(metadata['ip']) ?? null,
			userAgent: stringValue(metadata['userAgent']) ?? null,
			userId
		}
		this.#sessions.set(session.id, session)
		return session
	}

	async validateSession(
		sessionId: string
	): Promise<{ session: Session | null; user: User | null }> {
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
		for (const [id, session] of this.#sessions.entries()) {
			if (session.userId === userId) {
				this.#sessions.delete(id)
			}
		}
	}

	async listSessions(userId: string): Promise<Session[]> {
		return [...this.#sessions.values()].filter((session) => session.userId === userId)
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

/** In-memory WebAuthn adapter for challenges and credentials. */
export class MemoryWebAuthnAdapter extends WebAuthnAdapter {
	#challenges = new Map<string, Record<string, unknown>>()
	#credentials = new Map<string, WebAuthnCredential>()

	async createChallenge({
		challengeId,
		userId,
		challenge,
		type,
		expiresAt
	}: {
		challengeId: string
		userId?: string | null
		challenge: string
		type: string
		expiresAt: Date
	}): Promise<void> {
		this.#challenges.set(challengeId, {
			challenge,
			expiresAt,
			id: challengeId,
			type,
			userId: userId ?? null
		})
	}

	async getChallenge(challengeId: string): Promise<Record<string, unknown> | null> {
		return this.#challenges.get(challengeId) ?? null
	}

	async deleteChallenge(challengeId: string): Promise<void> {
		this.#challenges.delete(challengeId)
	}

	async createCredential({
		userId,
		credentialId,
		publicKey,
		counter,
		transports,
		name
	}: {
		userId: string
		credentialId: string
		publicKey: string
		counter: number
		transports?: string[] | null
		name?: string | null
	}): Promise<void> {
		const now = new Date()
		this.#credentials.set(credentialId, {
			counter,
			createdAt: now,
			credentialId,
			id: credentialId,
			name: name ?? null,
			publicKey,
			transports: transports ?? null,
			updatedAt: now,
			userId
		})
	}

	async getCredential(credentialId: string): Promise<WebAuthnCredential | null> {
		return this.#credentials.get(credentialId) ?? null
	}

	async listCredentials(userId: string): Promise<WebAuthnCredential[]> {
		return [...this.#credentials.values()].filter((credential) => credential.userId === userId)
	}

	async updateCredential(credentialId: string, updates: Record<string, unknown>): Promise<void> {
		const existing = this.#credentials.get(credentialId)
		if (!existing) {
			return
		}
		const next: WebAuthnCredential = {
			...existing,
			updatedAt: new Date()
		}
		if (typeof updates['counter'] === 'number') {
			next.counter = updates['counter']
		}
		if (updates['name'] === null || typeof updates['name'] === 'string') {
			next.name = updates['name']
		}
		if (
			updates['transports'] === null ||
			(Array.isArray(updates['transports']) &&
				updates['transports'].every((entry) => typeof entry === 'string'))
		) {
			next.transports = updates['transports']
		}
		this.#credentials.set(credentialId, next)
	}

	async deleteCredential(credentialId: string): Promise<void> {
		this.#credentials.delete(credentialId)
	}

	async deleteUserCredentials(userId: string): Promise<void> {
		for (const [credentialId, credential] of this.#credentials.entries()) {
			if (credential.userId === userId) {
				this.#credentials.delete(credentialId)
			}
		}
	}
}

/** In-memory MFA adapter for TOTP secrets and backup codes. */
export class MemoryMfaAdapter extends MfaAdapter {
	#backupCodes = new Map<string, Set<string>>()
	#factors = new Map<string, { enabledAt: Date | null; secret: string }>()

	async beginEnrollment(userId: string, secret: string, backupCodes: string[]): Promise<boolean> {
		if (backupCodes.length === 0) return false
		const existing = this.#factors.get(userId)
		if (existing?.enabledAt) return false
		this.#factors.set(userId, {
			enabledAt: null,
			secret
		})
		this.#backupCodes.set(userId, new Set(backupCodes))
		return true
	}

	async getSecret(userId: string): Promise<string | null> {
		return this.#factors.get(userId)?.secret ?? null
	}

	async activateEnrollment(userId: string): Promise<boolean> {
		const existing = this.#factors.get(userId)
		if (!existing || existing.enabledAt || !this.#backupCodes.get(userId)?.size) return false
		this.#factors.set(userId, {
			...existing,
			enabledAt: new Date()
		})
		return true
	}

	async disableMfa(userId: string): Promise<boolean> {
		const removed = this.#factors.delete(userId)
		this.#backupCodes.delete(userId)
		return removed
	}

	async getBackupCodes(userId: string): Promise<string[]> {
		return [...(this.#backupCodes.get(userId) ?? [])]
	}

	async consumeBackupCode(userId: string, hash: string): Promise<boolean> {
		return this.#backupCodes.get(userId)?.delete(hash) ?? false
	}

	async getStatus(userId: string): Promise<MfaStatus> {
		const factor = this.#factors.get(userId)
		return {
			backupCodeCount: this.#backupCodes.get(userId)?.size ?? 0,
			enabled: Boolean(factor?.enabledAt),
			enabledAt: factor?.enabledAt ?? null
		}
	}
}

/** Creates the default in-memory auth adapter bundle. */
export function createMemoryAuthAdapters(input: {
	cookieDomain?: string
	cookieName: string
	secureCookies: boolean
}) {
	const user = new MemoryUserAdapter()
	return {
		magicLink: new MemoryMagicLinkAdapter(),
		session: new MemorySessionAdapter({
			...(input.cookieDomain ? { cookieDomain: input.cookieDomain } : {}),
			cookieName: input.cookieName,
			secureCookies: input.secureCookies,
			users: user
		}),
		mfa: new MemoryMfaAdapter(),
		user,
		webauthn: new MemoryWebAuthnAdapter()
	}
}

/** Test user adapter backed by the memory implementation. */
export class MockUserAdapter extends MemoryUserAdapter {}

/** Test session adapter with no-op cookie writes. */
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

/** Test OAuth token adapter backed by an in-memory map. */
export class MockTokenAdapter extends TokenAdapter {
	#tokens = new Map<string, OAuthTokens>()

	async storeTokens(userId: string, provider: string, tokens: OAuthTokens): Promise<void> {
		this.#tokens.set(`${userId}:${provider}`, tokens)
	}

	async getTokens(userId: string, provider: string): Promise<OAuthTokens | null> {
		return this.#tokens.get(`${userId}:${provider}`) ?? null
	}

	async refreshTokens(userId: string, provider: string): Promise<OAuthTokens | null> {
		return this.getTokens(userId, provider)
	}

	async deleteTokens(userId: string, provider: string): Promise<void> {
		this.#tokens.delete(`${userId}:${provider}`)
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
