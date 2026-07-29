import type { Cookies } from '@sveltejs/kit'
import type { Session, SessionMetadata, SessionSummary, User } from '../../types/index.ts'
import { SessionAdapter } from '../session/SessionAdapter.ts'
import { clearSessionCookie, writeSessionCookie } from '../session/_sessionCookie.ts'
import { normalizeSessionMetadata } from '../session/_sessionMetadata.ts'
import { createSessionToken, generateSessionId, hashSessionToken } from '../session/sessionId.ts'
import { MemoryUserAdapter } from './user.ts'

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

	async createSession(userId: string, metadata: SessionMetadata = {}): Promise<Session> {
		const normalized = normalizeSessionMetadata(metadata)
		const token = createSessionToken()
		const verifier = await hashSessionToken(token)
		const createdAt = normalized.createdAt ?? new Date()
		const session: Session = {
			createdAt,
			expiresAt: new Date(Date.now() + this.#sessionLifetimeMs),
			fingerprint: normalized.fingerprint ?? null,
			id: verifier,
			ip: normalized.ip ?? null,
			managementId: generateSessionId(),
			mfaVerifiedAt: normalized.mfaVerifiedAt ?? null,
			...(normalized.rememberMe !== undefined ? { rememberMe: normalized.rememberMe } : {}),
			userAgent: normalized.userAgent ?? null,
			userId
		}
		this.#sessions.set(verifier, session)
		return { ...session, id: token }
	}

	async validateSession(
		sessionId: string
	): Promise<{ session: Session | null; user: User | null }> {
		const verifier = await hashSessionToken(sessionId)
		const session = this.#sessions.get(verifier)
		if (!session) {
			return { session: null, user: null }
		}
		if (session.expiresAt.getTime() <= Date.now()) {
			this.#sessions.delete(verifier)
			return { session: null, user: null }
		}
		return {
			session: { ...session, id: sessionId },
			user: await this.#users.getUserById(session.userId)
		}
	}

	async invalidateSession(sessionId: string): Promise<void> {
		this.#sessions.delete(await hashSessionToken(sessionId))
	}

	async invalidateUserSessions(userId: string): Promise<void> {
		for (const [id, session] of this.#sessions.entries()) {
			if (session.userId === userId) {
				this.#sessions.delete(id)
			}
		}
	}

	async listManagedSessions(userId: string): Promise<SessionSummary[]> {
		return [...this.#sessions.values()].flatMap((session) =>
			session.userId === userId && session.managementId
				? [
						{
							id: session.managementId,
							userId,
							expiresAt: session.expiresAt,
							createdAt: session.createdAt ?? null,
							ip: session.ip ?? null,
							userAgent: session.userAgent ?? null
						}
					]
				: []
		)
	}

	async revokeManagedSession(userId: string, managementId: string): Promise<void> {
		for (const [verifier, session] of this.#sessions.entries()) {
			if (session.userId === userId && session.managementId === managementId) {
				this.#sessions.delete(verifier)
				return
			}
		}
	}

	setSessionCookie(cookies: Cookies, session: Session): void {
		writeSessionCookie(cookies, session, this.#cookieName, this.#secureCookies, this.#cookieDomain)
	}

	deleteSessionCookie(cookies: Cookies): void {
		clearSessionCookie(cookies, this.#cookieName, this.#cookieDomain)
	}
}
