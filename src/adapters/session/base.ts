import type { Session, User } from "../../types/core.js";
import type { Cookies } from "@sveltejs/kit";

/**
 * Base Session Adapter Interface
 * All session adapters must implement these methods
 */
export abstract class SessionAdapter {
	/**
	 * Create a new session for a user
	 * @param {string} userId - User ID to create session for
	 * @param {Object} [metadata] - Additional session metadata
	 * @returns {Promise<import('../../types/core.js').Session>}
	 */
	abstract createSession(
		userId: string,
		metadata?: Record<string, unknown>,
	): Promise<Session>;

	/**
	 * Validate a session and return session + sanitized user
	 * @param {string} sessionId - Session ID to validate
	 * @returns {Promise<{session: import('../../types/core.js').Session | null, user: import('../../types/core.js').User | null}>}
	 */
	abstract validateSession(
		sessionId: string,
	): Promise<{ session: Session | null; user: User | null }>;

	/**
	 * Invalidate a specific session
	 * @param {string} sessionId - Session ID to invalidate
	 * @returns {Promise<void>}
	 */
	abstract invalidateSession(sessionId: string): Promise<void>;

	/**
	 * Invalidate all sessions for a user
	 * @param {string} userId - User ID whose sessions to invalidate
	 * @returns {Promise<void>}
	 */
	abstract invalidateUserSessions(userId: string): Promise<void>;

	/**
	 * List sessions for a user
	 * @param {string} userId - User ID
	 * @returns {Promise<Array<import('../../types/core.js').Session>>}
	 */
	abstract listSessions(userId: string): Promise<Session[]>;

	/**
	 * Set session cookie
	 * @param {import('@sveltejs/kit').Cookies} cookies - SvelteKit cookies object
	 * @param {import('../../types/core.js').Session} session - Session to set
	 * @returns {void}
	 */
	abstract setSessionCookie(cookies: Cookies, session: Session): void;

	/**
	 * Delete session cookie
	 * @param {import('@sveltejs/kit').Cookies} cookies - SvelteKit cookies object
	 * @returns {void}
	 */
	abstract deleteSessionCookie(cookies: Cookies): void;
}
