import type { Cookies } from '@sveltejs/kit'
import { eq } from 'drizzle-orm'

import type { Session, SessionMetadata, User } from '../../types/index.ts'
import { toDrizzleUser as toUser } from '../_drizzleUser.ts'
import type { DrizzleDbLike, DrizzleRow, DrizzleTable } from '../drizzleTypes.ts'
import { normalizeSessionMetadata } from './_sessionMetadata.ts'
import { clearSessionCookie, writeSessionCookie } from './_sessionCookie.ts'
import { SessionAdapter } from './SessionAdapter.ts'
import { parseMfaVerifiedAt, parseSessionTimestamp } from './sessionAssurance.ts'
import { createSessionToken, hashSessionToken } from './sessionId.ts'

type SessionsTable = DrizzleTable & {
	id: DrizzleTable[string]
	userId: DrizzleTable[string]
	expiresAt: DrizzleTable[string]
	createdAt?: DrizzleTable[string]
	lastActiveAt?: DrizzleTable[string]
	mfaVerifiedAt?: DrizzleTable[string]
	ip?: DrizzleTable[string]
	userAgent?: DrizzleTable[string]
	fingerprint?: DrizzleTable[string]
}

type UsersTable = DrizzleTable & {
	id: DrizzleTable[string]
	email: DrizzleTable[string]
	name: DrizzleTable[string]
	avatar?: DrizzleTable[string]
	emailVerified?: DrizzleTable[string]
}

function toSession(row: DrizzleRow | null): Session | null {
	if (!row) return null
	const id = row['id']
	const userId = row['userId'] ?? row['user_id']
	const expiresAt = row['expiresAt'] ?? row['expires_at']
	if (typeof id !== 'string') return null
	if (typeof userId !== 'string' && typeof userId !== 'number') return null
	if (!(expiresAt instanceof Date) && typeof expiresAt !== 'string') return null
	const expiresDate = expiresAt instanceof Date ? expiresAt : new Date(expiresAt)
	if (Number.isNaN(expiresDate.getTime())) return null
	const mfaVerifiedAt = parseMfaVerifiedAt(row['mfaVerifiedAt'] ?? row['mfa_verified_at'])
	const createdAt = parseSessionTimestamp(row['createdAt'] ?? row['created_at'])
	return {
		id,
		userId: String(userId),
		expiresAt: expiresDate,
		...(createdAt ? { createdAt } : {}),
		lastActiveAt: parseSessionTimestamp(row['lastActiveAt'] ?? row['last_active_at']),
		ip: typeof row['ip'] === 'string' ? row['ip'] : null,
		userAgent:
			typeof (row['userAgent'] ?? row['user_agent']) === 'string'
				? String(row['userAgent'] ?? row['user_agent'])
				: null,
		mfaVerifiedAt
	}
}

/** Drizzle session adapter for sessions, users, tokens, MFA, magic links, or WebAuthn records. */
export class DrizzleSessionAdapter extends SessionAdapter {
	private db: DrizzleDbLike
	private sessionsTable: SessionsTable
	private usersTable: UsersTable
	private sessionLifetime: number
	private sessionRefreshThreshold: number

	// Exposed for auth hook resolution (`createAuth` reads adapter.cookieName).
	cookieName: string
	private secureCookies: boolean
	private sanitizeUser: (user: User | null) => User | null

	constructor(
		db: DrizzleDbLike,
		options: {
			sessionsTable?: SessionsTable
			usersTable?: UsersTable
			sessionLifetime?: number
			sessionRefreshThreshold?: number
			cookieName?: string
			secureCookies?: boolean
			sanitizeUser?: (user: User | null) => User | null
		} = {}
	) {
		super()
		if (!options.sessionsTable || !options.usersTable) {
			throw new Error('DrizzleSessionAdapter requires sessionsTable and usersTable options')
		}
		this.db = db
		this.sessionsTable = options.sessionsTable
		this.usersTable = options.usersTable
		this.sessionLifetime = options.sessionLifetime || 30 * 24 * 60 * 60 * 1000
		this.sessionRefreshThreshold = options.sessionRefreshThreshold || this.sessionLifetime / 2
		this.cookieName = options.cookieName || 'session'
		this.secureCookies = options.secureCookies !== false
		this.sanitizeUser = options.sanitizeUser || this._defaultSanitizeUser
	}

	_defaultSanitizeUser(user: User | null): User | null {
		return user
	}

	async createSession(userId: string, metadata: SessionMetadata = {}): Promise<Session> {
		const normalized = normalizeSessionMetadata(metadata)
		const token = createSessionToken()
		const verifier = await hashSessionToken(token)
		const createdAt = normalized.createdAt ?? new Date()
		const expiresAt = new Date(Date.now() + this.sessionLifetime)
		await this.db.insert(this.sessionsTable).values({
			id: verifier,
			userId,
			expiresAt,
			...(this.sessionsTable.createdAt ? { createdAt } : {}),
			...(this.sessionsTable.lastActiveAt ? { lastActiveAt: createdAt } : {}),
			...(this.sessionsTable.mfaVerifiedAt
				? { mfaVerifiedAt: normalized.mfaVerifiedAt ?? null }
				: {}),
			...(this.sessionsTable.ip ? { ip: normalized.ip ?? null } : {}),
			...(this.sessionsTable.userAgent ? { userAgent: normalized.userAgent ?? null } : {}),
			...(this.sessionsTable.fingerprint ? { fingerprint: normalized.fingerprint ?? null } : {})
		})
		return {
			id: token,
			userId,
			expiresAt,
			createdAt,
			lastActiveAt: createdAt,
			mfaVerifiedAt: normalized.mfaVerifiedAt ?? null,
			ip: normalized.ip ?? null,
			userAgent: normalized.userAgent ?? null,
			fingerprint: normalized.fingerprint ?? null,
			...(normalized.rememberMe !== undefined ? { rememberMe: normalized.rememberMe } : {})
		}
	}

	async validateSession(
		sessionId: string
	): Promise<{ session: Session | null; user: User | null }> {
		const verifier = await hashSessionToken(sessionId)
		const [result] = await this.db
			.select({
				user: this.usersTable,
				session: this.sessionsTable
			})
			.from(this.sessionsTable)
			.innerJoin(this.usersTable, eq(this.sessionsTable.userId, this.usersTable.id))
			.where(eq(this.sessionsTable.id, verifier))

		if (!result) return { session: null, user: null }
		const session = toSession(result['session'] ?? null)
		if (!session) return { session: null, user: null }
		if (Date.now() >= session.expiresAt.getTime()) {
			await this.db.delete(this.sessionsTable).where(eq(this.sessionsTable.id, verifier))
			return { session: null, user: null }
		}
		const shouldRefresh = Date.now() >= session.expiresAt.getTime() - this.sessionRefreshThreshold
		if (shouldRefresh) {
			session.expiresAt = new Date(Date.now() + this.sessionLifetime)
			session.fresh = true
			await this.db
				.update(this.sessionsTable)
				.set({ expiresAt: session.expiresAt })
				.where(eq(this.sessionsTable.id, verifier))
		}
		return {
			session: { ...session, id: sessionId },
			user: this.sanitizeUser(toUser(result['user'] ?? null))
		}
	}

	async invalidateSession(sessionId: string): Promise<void> {
		await this.db
			.delete(this.sessionsTable)
			.where(eq(this.sessionsTable.id, await hashSessionToken(sessionId)))
	}

	async invalidateUserSessions(userId: string): Promise<void> {
		await this.db.delete(this.sessionsTable).where(eq(this.sessionsTable.userId, userId))
	}

	setSessionCookie(cookies: Cookies, session: Session): void {
		writeSessionCookie(cookies, session, this.cookieName, this.secureCookies)
	}

	deleteSessionCookie(cookies: Cookies): void {
		clearSessionCookie(cookies, this.cookieName)
	}
}
