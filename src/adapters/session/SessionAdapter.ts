import type { Cookies } from '@sveltejs/kit'

import type { AuthSession, SessionMetadata, SessionSummary, User } from '../../types/core.ts'

/**
 * Base Session Adapter Interface
 * All session adapters must implement these methods
 */
export abstract class SessionAdapter {
	/** Cookie read and written by this adapter. */
	abstract readonly cookieName: string

	/**
	 * Create a new session for a user
	 * @param {string} userId - User ID to create session for
	 * @param {Object} [metadata] - Additional session metadata
	 * @returns {Promise<import('../../types/core.ts').AuthSession>}
	 */
	abstract createSession(userId: string, metadata?: SessionMetadata): Promise<AuthSession>

	/**
	 * Validate a session and return session + sanitized user
	 * @param {string} sessionId - Session ID to validate
	 * @returns {Promise<{session: import('../../types/core.ts').AuthSession | null, user: import('../../types/core.ts').User | null}>}
	 */
	abstract validateSession(
		sessionId: string
	): Promise<{ session: AuthSession | null; user: User | null }>

	/**
	 * Invalidate a specific session
	 * @param {string} sessionId - Session ID to invalidate
	 * @returns {Promise<void>}
	 */
	abstract invalidateSession(sessionId: string): Promise<void>

	/**
	 * Invalidate all sessions for a user
	 * @param {string} userId - User ID whose sessions to invalidate
	 * @returns {Promise<void>}
	 */
	abstract invalidateUserSessions(userId: string): Promise<void>

	/**
	 * List non-secret session-management records for a user.
	 * Adapters must not expose bearer session IDs through this capability.
	 */
	listManagedSessions?(userId: string): Promise<SessionSummary[]>

	/** Revoke one session by its non-secret management handle and owner. */
	revokeManagedSession?(userId: string, managementId: string): Promise<void>

	/**
	 * Set session cookie
	 * @param {import('@sveltejs/kit').Cookies} cookies - SvelteKit cookies object
	 * @param {import('../../types/core.ts').AuthSession} session - Session to set
	 * @returns {void}
	 */
	abstract setSessionCookie(cookies: Cookies, session: AuthSession): void

	/**
	 * Delete session cookie
	 * @param {import('@sveltejs/kit').Cookies} cookies - SvelteKit cookies object
	 * @returns {void}
	 */
	abstract deleteSessionCookie(cookies: Cookies): void
}

/** Optional session-management capability that never exposes bearer tokens. */
export interface ManagedSessionAdapter {
	listManagedSessions(userId: string): Promise<SessionSummary[]>
	revokeManagedSession(userId: string, managementId: string): Promise<void>
}
