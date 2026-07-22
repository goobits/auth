import type { Cookies } from '@sveltejs/kit'

import { errorContext, resolveLogger, type Logger } from '../../_internal/logger.ts'
import { AuthAdapterCapabilityError } from '../../errors/AuthPrincipalResolutionError.ts'
import type { Session, SessionMetadata, SessionSummary, User } from '../../types/index.ts'
import { SessionAdapter } from './SessionAdapter.ts'
import { normalizeSessionMetadata } from './_sessionMetadata.ts'
import { clearSessionCookie, writeSessionCookie } from './_sessionCookie.ts'
import { parseMfaVerifiedAt, parseSessionTimestamp } from './sessionAssurance.ts'
import { createSessionToken, generateSessionId, hashSessionToken } from './sessionId.ts'

type KVNamespaceLike = {
	put: (key: string, value: string, options?: { expirationTtl?: number }) => Promise<void>
	get: (
		key: string,
		options?: { type?: 'json' | 'text' }
	) => Promise<Record<string, unknown> | string | null>
	delete: (key: string) => Promise<void>
	list?: (options?: { prefix?: string }) => Promise<{ keys?: Array<{ name: string }> }>
}

type KVSessionRecord = {
	userId: string
	expiresAt: string
	createdAt?: string
	mfaVerifiedAt?: string
	managementId: string
	ip?: string
	userAgent?: string
	fingerprint?: string
	rememberMe?: boolean
}

function isKVSessionRecord(
	value: Record<string, unknown> | string | null
): value is KVSessionRecord {
	if (!value || typeof value !== 'object') return false
	return (
		'userId' in value &&
		typeof value['userId'] === 'string' &&
		'expiresAt' in value &&
		typeof value['expiresAt'] === 'string' &&
		(!('createdAt' in value) || typeof value['createdAt'] === 'string') &&
		(!('mfaVerifiedAt' in value) || typeof value['mfaVerifiedAt'] === 'string') &&
		'managementId' in value &&
		typeof value['managementId'] === 'string' &&
		(!('ip' in value) || typeof value['ip'] === 'string') &&
		(!('userAgent' in value) || typeof value['userAgent'] === 'string') &&
		(!('fingerprint' in value) || typeof value['fingerprint'] === 'string') &&
		(!('rememberMe' in value) || typeof value['rememberMe'] === 'boolean')
	)
}

/** KV session adapter for sessions, users, tokens, MFA, magic links, or WebAuthn records. */
export class KVSessionAdapter extends SessionAdapter {
	private namespace: KVNamespaceLike
	private sessionLifetime: number
	private sessionRefreshThreshold: number

	// Exposed for auth hook resolution (`createAuth` reads adapter.cookieName).
	cookieName: string
	private secureCookies: boolean
	private getUserById: ((id: string) => Promise<User | null>) | null
	private sanitizeUser: (user: User | null) => User | null
	private keyPrefix: string
	private readonly logger: Logger

	constructor(
		namespace: KVNamespaceLike,
		options: {
			sessionLifetime?: number
			sessionRefreshThreshold?: number
			cookieName?: string
			secureCookies?: boolean
			getUserById?: (id: string) => Promise<User | null>
			sanitizeUser?: (user: User | null) => User | null
			keyPrefix?: string
			logger?: Logger
		} = {}
	) {
		super()
		this.namespace = namespace
		this.sessionLifetime = options.sessionLifetime || 30 * 24 * 60 * 60 * 1000
		this.sessionRefreshThreshold = options.sessionRefreshThreshold || this.sessionLifetime / 2
		this.cookieName = options.cookieName || 'session'
		this.secureCookies = options.secureCookies !== false
		this.getUserById = options.getUserById || null
		this.sanitizeUser = options.sanitizeUser || this._defaultSanitizeUser
		this.keyPrefix = options.keyPrefix || 'session'
		this.logger = resolveLogger(options.logger)
	}

	_defaultSanitizeUser(user: User | null): User | null {
		return user
	}

	_key(sessionId: string) {
		return `${this.keyPrefix}:${sessionId}`
	}

	async createSession(userId: string, metadata: SessionMetadata = {}) {
		const normalized = normalizeSessionMetadata(metadata)
		const token = createSessionToken()
		const verifier = await hashSessionToken(token)
		const managementId = generateSessionId()
		const expiresAt = new Date(Date.now() + this.sessionLifetime)
		const createdAt = normalized.createdAt ?? new Date()
		const mfaVerifiedAt = normalized.mfaVerifiedAt
		const payload = {
			userId,
			expiresAt: expiresAt.toISOString(),
			createdAt: createdAt.toISOString(),
			managementId,
			...(mfaVerifiedAt ? { mfaVerifiedAt: mfaVerifiedAt.toISOString() } : {}),
			...(normalized.ip ? { ip: normalized.ip } : {}),
			...(normalized.userAgent ? { userAgent: normalized.userAgent } : {}),
			...(normalized.fingerprint ? { fingerprint: normalized.fingerprint } : {}),
			...(normalized.rememberMe !== undefined ? { rememberMe: normalized.rememberMe } : {})
		}
		await this.namespace.put(this._key(verifier), JSON.stringify(payload), {
			expirationTtl: Math.ceil(this.sessionLifetime / 1000)
		})
		return {
			id: token,
			managementId,
			userId,
			expiresAt,
			createdAt,
			mfaVerifiedAt: mfaVerifiedAt ?? null,
			ip: normalized.ip ?? null,
			userAgent: normalized.userAgent ?? null,
			fingerprint: normalized.fingerprint ?? null,
			...(normalized.rememberMe !== undefined ? { rememberMe: normalized.rememberMe } : {})
		}
	}

	async validateSession(sessionId: string): Promise<{
		session: Session | null
		user: User | null
	}> {
		const verifier = await hashSessionToken(sessionId)
		// SessionAdapter contract requires validateSession to never throw.
		// Any storage-level failure (network, permission) returns the empty
		// principal and is logged.
		let rawValue: Record<string, unknown> | string | null
		try {
			rawValue = await this.namespace.get(this._key(verifier), { type: 'json' })
		} catch (error) {
			this.logger.warn('[KVSessionAdapter] validateSession KV.get failed', errorContext(error))
			return { session: null, user: null }
		}
		const raw = isKVSessionRecord(rawValue) ? rawValue : null
		if (!raw) return { session: null, user: null }

		const expiresAt = new Date(raw.expiresAt)
		if (Date.now() >= expiresAt.getTime()) {
			try {
				await this.namespace.delete(this._key(verifier))
			} catch (error) {
				this.logger.warn('[KVSessionAdapter] failed to delete expired session', errorContext(error))
			}
			return { session: null, user: null }
		}

		const shouldRefresh = Date.now() >= expiresAt.getTime() - this.sessionRefreshThreshold
		let fresh = false
		let newExpiresAt = expiresAt

		if (shouldRefresh) {
			newExpiresAt = new Date(Date.now() + this.sessionLifetime)
			try {
				await this.namespace.put(
					this._key(verifier),
					JSON.stringify({
						...raw,
						expiresAt: newExpiresAt.toISOString()
					}),
					{ expirationTtl: Math.ceil(this.sessionLifetime / 1000) }
				)
				fresh = true
			} catch (error) {
				// Refresh is best-effort; the session is still valid until it expires.
				this.logger.warn('[KVSessionAdapter] session refresh failed', errorContext(error))
				newExpiresAt = expiresAt
			}
		}

		let user: User | null = null
		if (this.getUserById) {
			try {
				user = this.sanitizeUser(await this.getUserById(String(raw.userId ?? '')))
			} catch (error) {
				this.logger.warn(
					'[KVSessionAdapter] getUserById hook threw during validateSession',
					errorContext(error)
				)
			}
		}

		const createdAt = parseSessionTimestamp(raw.createdAt)
		return {
			session: {
				id: sessionId,
				managementId: raw.managementId,
				userId: raw.userId,
				expiresAt: newExpiresAt,
				fresh,
				...(createdAt ? { createdAt } : {}),
				mfaVerifiedAt: parseMfaVerifiedAt(raw.mfaVerifiedAt),
				ip: raw.ip ?? null,
				userAgent: raw.userAgent ?? null,
				fingerprint: raw.fingerprint ?? null,
				...(raw.rememberMe !== undefined ? { rememberMe: raw.rememberMe } : {})
			},
			user
		}
	}

	async invalidateSession(sessionId: string) {
		await this.namespace.delete(this._key(await hashSessionToken(sessionId)))
	}

	async invalidateUserSessions(userId: string) {
		if (typeof this.namespace.list !== 'function') {
			throw new AuthAdapterCapabilityError(
				'KVSessionAdapter requires a KV namespace with list() support for invalidateUserSessions'
			)
		}
		const matching = await this._listStoredEntries(userId)
		await Promise.all(
			matching.map(({ key }) =>
				this.namespace.delete(key).catch((error) => {
					this.logger.warn(
						'[KVSessionAdapter] failed to delete session during bulk invalidate',
						errorContext(error)
					)
				})
			)
		)
	}

	private async _listStoredEntries(
		userId: string
	): Promise<Array<{ key: string; record: KVSessionRecord }>> {
		if (typeof this.namespace.list !== 'function') {
			throw new AuthAdapterCapabilityError(
				'KVSessionAdapter requires a KV namespace with list() support for session management'
			)
		}
		const keys = await this.namespace.list({ prefix: `${this.keyPrefix}:` })
		const sessions: Array<{ key: string; record: KVSessionRecord }> = []
		for (const key of keys.keys ?? []) {
			const rawValue = await this.namespace.get(key.name, { type: 'json' })
			const raw = isKVSessionRecord(rawValue) ? rawValue : null
			if (!raw) continue
			if (raw.userId !== userId) continue
			sessions.push({ key: key.name, record: raw })
		}
		return sessions
	}

	override async listManagedSessions(userId: string): Promise<SessionSummary[]> {
		return (await this._listStoredEntries(userId)).map(({ record }) => ({
			id: record.managementId,
			userId: record.userId,
			expiresAt: new Date(record.expiresAt),
			createdAt: parseSessionTimestamp(record.createdAt),
			ip: record.ip ?? null,
			userAgent: record.userAgent ?? null
		}))
	}

	override async revokeManagedSession(userId: string, managementId: string): Promise<void> {
		for (const { key, record } of await this._listStoredEntries(userId)) {
			if (record.managementId === managementId) {
				await this.namespace.delete(key)
				return
			}
		}
	}

	setSessionCookie(cookies: Cookies, session: { id: string; expiresAt: Date }) {
		writeSessionCookie(cookies, session, this.cookieName, this.secureCookies)
	}

	deleteSessionCookie(cookies: Cookies) {
		clearSessionCookie(cookies, this.cookieName)
	}
}
