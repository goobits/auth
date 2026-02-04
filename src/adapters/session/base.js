/**
 * Base Session Adapter Interface
 * All session adapters must implement these methods
 */
export class SessionAdapter {
	/**
	 * Create a new session for a user
	 * @param {string} userId - User ID to create session for
	 * @param {Object} [metadata] - Additional session metadata
	 * @returns {Promise<import('../../types').Session>}
	 */
	async createSession(userId, metadata = {}) {
		throw new Error("createSession must be implemented");
	}

	/**
	 * Validate a session and return session + sanitized user
	 * @param {string} sessionId - Session ID to validate
	 * @returns {Promise<{session: import('../../types').Session | null, user: import('../../types').User | null}>}
	 */
	async validateSession(sessionId) {
		throw new Error("validateSession must be implemented");
	}

	/**
	 * Invalidate a specific session
	 * @param {string} sessionId - Session ID to invalidate
	 * @returns {Promise<void>}
	 */
	async invalidateSession(sessionId) {
		throw new Error("invalidateSession must be implemented");
	}

	/**
	 * Invalidate all sessions for a user
	 * @param {string} userId - User ID whose sessions to invalidate
	 * @returns {Promise<void>}
	 */
	async invalidateUserSessions(userId) {
		throw new Error("invalidateUserSessions must be implemented");
	}

	/**
	 * List sessions for a user
	 * @param {string} userId - User ID
	 * @returns {Promise<Array<import('../../types').Session>>}
	 */
	async listSessions(userId) {
		throw new Error("listSessions must be implemented");
	}

	/**
	 * Set session cookie
	 * @param {import('@sveltejs/kit').Cookies} cookies - SvelteKit cookies object
	 * @param {import('../../types').Session} session - Session to set
	 * @returns {void}
	 */
	setSessionCookie(cookies, session) {
		throw new Error("setSessionCookie must be implemented");
	}

	/**
	 * Delete session cookie
	 * @param {import('@sveltejs/kit').Cookies} cookies - SvelteKit cookies object
	 * @returns {void}
	 */
	deleteSessionCookie(cookies) {
		throw new Error("deleteSessionCookie must be implemented");
	}
}
