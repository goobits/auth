import type { Cookies } from '@sveltejs/kit'

import type { SessionMetadata, SessionSummary, User } from '../../types/index.ts'
import { AuthAdapterCapabilityError } from '../../errors/AuthPrincipalResolutionError.ts'
import type { D1DatabasePort, D1Value } from '../_d1Port.ts'
import { assertD1Identifiers } from '../_d1Sql.ts'
import { normalizeSessionMetadata } from './_sessionMetadata.ts'
import { mapD1SessionUser, type D1UserColumns } from './_d1SessionUser.ts'
import { clearSessionCookie, writeSessionCookie } from './_sessionCookie.ts'
import { SessionAdapter } from './SessionAdapter.ts'
import { parseMfaVerifiedAt, parseSessionTimestamp } from './sessionAssurance.ts'
import { createSessionToken, generateSessionId, hashSessionToken } from './sessionId.ts'

type D1SessionOptions = {
	sessionsTable?: string
	usersTable?: string
	sessionLifetime?: number
	sessionRefreshThreshold?: number
	cookieName?: string
	secureCookies?: boolean
	/** Storage encoding for assurance and activity timestamps. Expiry remains ISO text. */
	timestampFormat?: 'iso' | 'unix-seconds'
	sanitizeUser?: (user: User | null) => User | null
	columns?: Partial<{
		sessionId: string
		managementId: string | null
		userId: string
		expiresAt: string
		createdAt: string | null
		lastActiveAt: string | null
		mfaVerifiedAt: string | null
		ip: string | null
		userAgent: string | null
	}>
	userColumns?: Partial<D1UserColumns>
}

/** Cloudflare D1 session adapter for sessions, users, tokens, MFA, magic links, or WebAuthn records. */
export class D1SessionAdapter extends SessionAdapter {
	private db: D1DatabasePort
	private sessionsTable: string
	private usersTable: string
	private sessionLifetime: number
	private sessionRefreshThreshold: number

	// Exposed for auth hook resolution (`createAuth` reads adapter.cookieName).
	cookieName: string
	private secureCookies: boolean
	private timestampFormat: 'iso' | 'unix-seconds'
	private sanitizeUser: (user: User | null) => User | null
	private columns: {
		sessionId: string
		managementId: string | null
		userId: string
		expiresAt: string
		createdAt: string | null
		lastActiveAt: string | null
		mfaVerifiedAt: string | null
		ip: string | null
		userAgent: string | null
	}
	private userColumns: D1UserColumns

	constructor(db: D1DatabasePort, options: D1SessionOptions = {}) {
		super()
		this.db = db
		this.sessionsTable = options.sessionsTable || 'sessions'
		this.usersTable = options.usersTable || 'users'
		this.sessionLifetime = options.sessionLifetime || 30 * 24 * 60 * 60 * 1000
		this.sessionRefreshThreshold = options.sessionRefreshThreshold || this.sessionLifetime / 2
		this.cookieName = options.cookieName || 'session'
		this.secureCookies = options.secureCookies !== false
		this.timestampFormat = options.timestampFormat ?? 'iso'
		this.sanitizeUser = options.sanitizeUser || this._defaultSanitizeUser
		this.columns = {
			sessionId: options.columns?.sessionId || 'id',
			managementId: options.columns?.managementId ?? null,
			userId: options.columns?.userId || 'user_id',
			expiresAt: options.columns?.expiresAt || 'expires_at',
			createdAt: options.columns?.createdAt || null,
			lastActiveAt: options.columns?.lastActiveAt || null,
			mfaVerifiedAt: options.columns?.mfaVerifiedAt ?? null,
			ip: options.columns?.ip || null,
			userAgent: options.columns?.userAgent || null
		}
		this.userColumns = {
			id: options.userColumns?.id || 'id',
			email: options.userColumns?.email || 'email',
			name: options.userColumns?.name || 'name',
			avatar: options.userColumns?.avatar || 'avatar',
			password: options.userColumns?.password || 'password',
			emailVerified: options.userColumns?.emailVerified || 'email_verified',
			role: options.userColumns?.role || 'role',
			settings: options.userColumns?.settings || 'settings',
			createdAt: options.userColumns?.createdAt || 'created_at',
			updatedAt: options.userColumns?.updatedAt || 'updated_at'
		}
		assertD1Identifiers({
			sessionsTable: this.sessionsTable,
			usersTable: this.usersTable,
			...Object.fromEntries(
				Object.entries(this.columns).map(([key, value]) => [`sessions.${key}`, value])
			),
			...Object.fromEntries(
				Object.entries(this.userColumns).map(([key, value]) => [`users.${key}`, value])
			)
		})
	}

	_defaultSanitizeUser(user: User | null): User | null {
		return user
	}

	private _coerceDbId(id: string): string | number {
		return /^\d+$/.test(id) ? Number(id) : id
	}

	private _serializeTimestamp(value: Date): string | number {
		return this.timestampFormat === 'unix-seconds'
			? Math.floor(value.getTime() / 1000)
			: value.toISOString()
	}

	private _parseStoredTimestamp(value: unknown): Date | null {
		return parseSessionTimestamp(
			value,
			this.timestampFormat === 'unix-seconds' ? 'seconds' : 'milliseconds'
		)
	}

	private _parseStoredMfaTimestamp(value: unknown): Date | null {
		return parseMfaVerifiedAt(
			value,
			this.timestampFormat === 'unix-seconds' ? 'seconds' : 'milliseconds'
		)
	}

	async createSession(userId: string, metadata: SessionMetadata = {}) {
		const normalized = normalizeSessionMetadata(metadata)
		const token = createSessionToken()
		const verifier = await hashSessionToken(token)
		const managementId = this.columns.managementId ? generateSessionId() : null
		const createdAt = normalized.createdAt ?? new Date()
		const expiresAt = new Date(Date.now() + this.sessionLifetime)
		const mfaVerifiedAt = normalized.mfaVerifiedAt
		const columns = [this.columns.sessionId, this.columns.userId, this.columns.expiresAt]
		const values: D1Value[] = [verifier, this._coerceDbId(userId), expiresAt.toISOString()]
		if (this.columns.managementId) {
			columns.push(this.columns.managementId)
			values.push(managementId)
		}
		if (this.columns.mfaVerifiedAt) {
			columns.push(this.columns.mfaVerifiedAt)
			values.push(mfaVerifiedAt ? this._serializeTimestamp(mfaVerifiedAt) : null)
		}
		if (this.columns.createdAt) {
			columns.push(this.columns.createdAt)
			values.push(this._serializeTimestamp(createdAt))
		}
		if (this.columns.lastActiveAt) {
			columns.push(this.columns.lastActiveAt)
			values.push(this._serializeTimestamp(createdAt))
		}
		if (this.columns.ip) {
			columns.push(this.columns.ip)
			values.push(normalized.ip ?? null)
		}
		if (this.columns.userAgent) {
			columns.push(this.columns.userAgent)
			values.push(normalized.userAgent ?? null)
		}
		const placeholders = columns.map(() => '?').join(', ')
		await this.db
			.prepare(`INSERT INTO ${this.sessionsTable} (${columns.join(', ')}) VALUES (${placeholders})`)
			.bind(...values)
			.run()
		return {
			id: token,
			...(managementId ? { managementId } : {}),
			userId,
			expiresAt,
			createdAt,
			lastActiveAt: createdAt,
			mfaVerifiedAt: mfaVerifiedAt ?? null,
			ip: normalized.ip ?? null,
			userAgent: normalized.userAgent ?? null,
			fingerprint: normalized.fingerprint ?? null,
			...(normalized.rememberMe !== undefined ? { rememberMe: normalized.rememberMe } : {})
		}
	}

	async validateSession(sessionId: string) {
		const verifier = await hashSessionToken(sessionId)
		const optionalSelection = (column: string | null, alias: string) =>
			column ? `s.${column} as ${alias}` : `NULL as ${alias}`
		const assuranceSelection = this.columns.mfaVerifiedAt
			? `s.${this.columns.mfaVerifiedAt} as mfa_verified_at`
			: 'NULL as mfa_verified_at'
		const sql = `SELECT s.${this.columns.sessionId} as session_id, ${optionalSelection(this.columns.managementId, 'session_management_id')}, s.${this.columns.userId} as user_id, s.${this.columns.expiresAt} as expires_at, ${optionalSelection(this.columns.createdAt, 'session_created_at')}, ${optionalSelection(this.columns.lastActiveAt, 'last_active_at')}, ${optionalSelection(this.columns.ip, 'session_ip')}, ${optionalSelection(this.columns.userAgent, 'session_user_agent')}, ${assuranceSelection}, u.*
		FROM ${this.sessionsTable} s
		JOIN ${this.usersTable} u ON s.${this.columns.userId} = u.${this.userColumns.id}
		WHERE s.${this.columns.sessionId} = ? LIMIT 1`
		const row = await this.db.prepare(sql).bind(verifier).first()
		if (!row) return { session: null, user: null }

		const expiresAtRaw = row['expires_at']
		if (typeof expiresAtRaw !== 'string') return { session: null, user: null }
		const expiresAt = new Date(expiresAtRaw)
		if (Number.isNaN(expiresAt.getTime())) return { session: null, user: null }
		if (Date.now() >= expiresAt.getTime()) {
			await this.db
				.prepare(`DELETE FROM ${this.sessionsTable} WHERE ${this.columns.sessionId} = ?`)
				.bind(verifier)
				.run()
			return { session: null, user: null }
		}

		const shouldRefresh = Date.now() >= expiresAt.getTime() - this.sessionRefreshThreshold
		let fresh = false
		let newExpiresAt = expiresAt
		let lastActiveAt = this._parseStoredTimestamp(row['last_active_at'])

		if (shouldRefresh) {
			newExpiresAt = new Date(Date.now() + this.sessionLifetime)
			const activityUpdate = this.columns.lastActiveAt ? `, ${this.columns.lastActiveAt} = ?` : ''
			const values: D1Value[] = [newExpiresAt.toISOString()]
			if (this.columns.lastActiveAt) {
				lastActiveAt = new Date()
				values.push(this._serializeTimestamp(lastActiveAt))
			}
			values.push(verifier)
			await this.db
				.prepare(
					`UPDATE ${this.sessionsTable} SET ${this.columns.expiresAt} = ?${activityUpdate} WHERE ${this.columns.sessionId} = ?`
				)
				.bind(...values)
				.run()
			fresh = true
		}

		const user = this.sanitizeUser(mapD1SessionUser(row, this.userColumns))
		const userIdRaw = row['user_id']
		if (typeof userIdRaw !== 'string' && typeof userIdRaw !== 'number') {
			return { session: null, user: null }
		}
		const createdAt = this._parseStoredTimestamp(row['session_created_at'])
		const managementIdRaw = row['session_management_id']
		return {
			session: {
				id: sessionId,
				...(typeof managementIdRaw === 'string' ? { managementId: managementIdRaw } : {}),
				userId: String(userIdRaw),
				expiresAt: newExpiresAt,
				fresh,
				...(createdAt ? { createdAt } : {}),
				lastActiveAt,
				mfaVerifiedAt: this._parseStoredMfaTimestamp(row['mfa_verified_at']),
				ip: typeof row['session_ip'] === 'string' ? row['session_ip'] : null,
				userAgent: typeof row['session_user_agent'] === 'string' ? row['session_user_agent'] : null
			},
			user
		}
	}

	async invalidateSession(sessionId: string) {
		await this.db
			.prepare(`DELETE FROM ${this.sessionsTable} WHERE ${this.columns.sessionId} = ?`)
			.bind(await hashSessionToken(sessionId))
			.run()
	}

	async invalidateUserSessions(userId: string) {
		await this.db
			.prepare(`DELETE FROM ${this.sessionsTable} WHERE ${this.columns.userId} = ?`)
			.bind(this._coerceDbId(userId))
			.run()
	}

	override async listManagedSessions(userId: string): Promise<SessionSummary[]> {
		if (!this.columns.managementId) {
			throw new AuthAdapterCapabilityError(
				'D1SessionAdapter requires a managementId column for session management'
			)
		}
		const optionalSelection = (column: string | null, alias: string) =>
			column ? `${column} as ${alias}` : `NULL as ${alias}`
		const sql = `SELECT ${this.columns.managementId} as management_id, ${this.columns.userId} as user_id, ${this.columns.expiresAt} as expires_at, ${optionalSelection(this.columns.createdAt, 'created_at')}, ${optionalSelection(this.columns.lastActiveAt, 'last_active_at')}, ${optionalSelection(this.columns.ip, 'session_ip')}, ${optionalSelection(this.columns.userAgent, 'session_user_agent')} FROM ${this.sessionsTable} WHERE ${this.columns.userId} = ?`
		const result = await this.db.prepare(sql).bind(this._coerceDbId(userId)).all()
		return (result.results ?? []).flatMap((row) => {
			const managementId = row['management_id']
			const storedUserId = row['user_id']
			const expiresAtRaw = row['expires_at']
			if (
				typeof managementId !== 'string' ||
				(typeof storedUserId !== 'string' && typeof storedUserId !== 'number') ||
				typeof expiresAtRaw !== 'string'
			) {
				return []
			}
			const expiresAt = new Date(expiresAtRaw)
			if (Number.isNaN(expiresAt.getTime())) return []
			return [
				{
					id: managementId,
					userId: String(storedUserId),
					expiresAt,
					createdAt: this._parseStoredTimestamp(row['created_at']),
					lastActiveAt: this._parseStoredTimestamp(row['last_active_at']),
					ip: typeof row['session_ip'] === 'string' ? row['session_ip'] : null,
					userAgent:
						typeof row['session_user_agent'] === 'string' ? row['session_user_agent'] : null
				}
			]
		})
	}

	override async revokeManagedSession(userId: string, managementId: string): Promise<void> {
		if (!this.columns.managementId) {
			throw new AuthAdapterCapabilityError(
				'D1SessionAdapter requires a managementId column for session management'
			)
		}
		await this.db
			.prepare(
				`DELETE FROM ${this.sessionsTable} WHERE ${this.columns.managementId} = ? AND ${this.columns.userId} = ?`
			)
			.bind(managementId, this._coerceDbId(userId))
			.run()
	}

	setSessionCookie(cookies: Cookies, session: { id: string; expiresAt: Date }) {
		writeSessionCookie(cookies, session, this.cookieName, this.secureCookies)
	}

	deleteSessionCookie(cookies: Cookies) {
		clearSessionCookie(cookies, this.cookieName, this.secureCookies)
	}
}
