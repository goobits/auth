import type { Cookies } from '@sveltejs/kit'
import type { AuthSession, SessionMetadata, User } from '../../types/index.ts'
import { SessionAdapter } from '../session/SessionAdapter.ts'
import { clearSessionCookie, writeSessionCookie } from '../session/_sessionCookie.ts'
import { normalizeSessionMetadata } from '../session/_sessionMetadata.ts'
import { createSessionToken, hashSessionToken } from '../session/sessionId.ts'
import { type PgPoolLike, requireRow } from './query.ts'
import { type UserRow, toUser } from './user.ts'

type SessionRow = {
	created_at: Date
	expires_at: Date
	fingerprint: string | null
	id: string
	ip: string | null
	last_active_at: Date | null
	mfa_verified_at: Date | null
	user_agent: string | null
	user_id: string
}

/** Postgres session adapter for sessions, users, tokens, MFA, magic links, or WebAuthn records. */
export class PgSessionAdapter extends SessionAdapter {
	#cookieDomain: string | undefined
	#cookieName: string
	#db: PgPoolLike
	#secureCookies: boolean
	#sessionLifetimeMs: number

	constructor({
		cookieDomain,
		cookieName,
		db,
		secureCookies,
		sessionLifetimeMs = 30 * 24 * 60 * 60 * 1000
	}: {
		cookieDomain?: string
		cookieName: string
		db: PgPoolLike
		secureCookies: boolean
		sessionLifetimeMs?: number
	}) {
		super()
		this.#cookieDomain = cookieDomain
		this.#cookieName = cookieName
		this.#db = db
		this.#secureCookies = secureCookies
		this.#sessionLifetimeMs = sessionLifetimeMs
	}

	get cookieName(): string {
		return this.#cookieName
	}

	async createSession(userId: string, metadata: SessionMetadata = {}): Promise<AuthSession> {
		const normalized = normalizeSessionMetadata(metadata)
		const token = createSessionToken()
		const verifier = await hashSessionToken(token)
		const createdAt = normalized.createdAt ?? new Date()
		const expiresAt = new Date(Date.now() + this.#sessionLifetimeMs)
		const row = (
			await this.#db.query<SessionRow>(
				`
			INSERT INTO auth_sessions (id, user_id, expires_at, ip, user_agent, fingerprint, mfa_verified_at, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			RETURNING *
		`,
				[
					verifier,
					userId,
					expiresAt,
					normalized.ip ?? null,
					normalized.userAgent ?? null,
					normalized.fingerprint ?? null,
					normalized.mfaVerifiedAt ?? null,
					createdAt
				]
			)
		).rows[0]
		return {
			...toSession(requireRow(row)),
			id: token,
			...(normalized.rememberMe !== undefined ? { rememberMe: normalized.rememberMe } : {})
		}
	}

	async validateSession(
		sessionId: string
	): Promise<{ session: AuthSession | null; user: User | null }> {
		const verifier = await hashSessionToken(sessionId)
		const row = (
			await this.#db.query<
				SessionRow & UserRow & { user_created_at: Date; user_id_for_user: string }
			>(
				`
			SELECT
				s.id AS id,
				s.user_id,
				s.expires_at,
				s.created_at,
				s.last_active_at,
				s.mfa_verified_at,
				s.ip,
				s.user_agent,
				s.fingerprint,
				u.id AS user_id_for_user,
				u.email,
				u.name,
				u.avatar,
				u.email_verified,
				u.role,
				u.settings,
				u.password,
				u.created_at AS user_created_at,
				u.updated_at
			FROM auth_sessions s
			JOIN auth_users u ON u.id = s.user_id
			WHERE s.id = $1
		`,
				[verifier]
			)
		).rows[0]
		if (!row) {
			return { session: null, user: null }
		}
		if (row.expires_at.getTime() <= Date.now()) {
			await this.invalidateSession(sessionId)
			return { session: null, user: null }
		}
		await this.#db.query('UPDATE auth_sessions SET last_active_at = now() WHERE id = $1', [
			verifier
		])
		return {
			session: { ...toSession(row), id: sessionId },
			user: toUser({
				...row,
				created_at: row.user_created_at,
				id: row.user_id_for_user
			})
		}
	}

	async invalidateSession(sessionId: string): Promise<void> {
		await this.#db.query('DELETE FROM auth_sessions WHERE id = $1', [
			await hashSessionToken(sessionId)
		])
	}

	async invalidateUserSessions(userId: string): Promise<void> {
		await this.#db.query('DELETE FROM auth_sessions WHERE user_id = $1', [userId])
	}

	setSessionCookie(cookies: Cookies, session: AuthSession): void {
		writeSessionCookie(cookies, session, this.#cookieName, this.#secureCookies, this.#cookieDomain)
	}

	deleteSessionCookie(cookies: Cookies): void {
		clearSessionCookie(cookies, this.#cookieName, this.#secureCookies, this.#cookieDomain)
	}
}

function toSession(row: SessionRow): AuthSession {
	return {
		createdAt: row.created_at,
		expiresAt: row.expires_at,
		fingerprint: row.fingerprint,
		id: row.id,
		ip: row.ip,
		lastActiveAt: row.last_active_at,
		mfaVerifiedAt: row.mfa_verified_at,
		userAgent: row.user_agent,
		userId: row.user_id
	}
}
