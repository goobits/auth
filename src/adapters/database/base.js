/**
 * Base Database Adapter Interface
 * All database adapters must implement these methods
 */
export class DatabaseAdapter {
	/**
	 * Create a new user (returns SANITIZED user)
	 * @param {import('../../types').OAuthProfile} profile - OAuth profile
	 * @param {Object} [metadata] - Additional user metadata
	 * @returns {Promise<import('../../types').User>}
	 */
	async createUser(profile, metadata = {}) {
		throw new Error("createUser must be implemented");
	}

	/**
	 * Get user by ID (returns SANITIZED user)
	 * @param {string} id - User ID
	 * @returns {Promise<import('../../types').User | null>}
	 */
	async getUserById(id) {
		throw new Error("getUserById must be implemented");
	}

	/**
	 * Get user by email (returns SANITIZED user)
	 * @param {string} email - Email address
	 * @returns {Promise<import('../../types').User | null>}
	 */
	async getUserByEmail(email) {
		throw new Error("getUserByEmail must be implemented");
	}

	/**
	 * Get user by OAuth provider ID (returns SANITIZED user)
	 * @param {string} provider - Provider name (e.g., 'google', 'apple')
	 * @param {string} providerId - Provider-specific user ID
	 * @returns {Promise<import('../../types').User | null>}
	 */
	async getUserByProviderId(provider, providerId) {
		throw new Error("getUserByProviderId must be implemented");
	}

	/**
	 * Update user (returns SANITIZED user)
	 * @param {string} id - User ID
	 * @param {Partial<import('../../types').User>} data - Fields to update
	 * @returns {Promise<import('../../types').User>}
	 */
	async updateUser(id, data) {
		throw new Error("updateUser must be implemented");
	}

	/**
	 * Delete user
	 * @param {string} id - User ID
	 * @returns {Promise<void>}
	 */
	async deleteUser(id) {
		throw new Error("deleteUser must be implemented");
	}

	/**
	 * Link OAuth account to user
	 * @param {string} userId - User ID
	 * @param {string} provider - Provider name
	 * @param {string} providerAccountId - Provider account ID
	 * @returns {Promise<void>}
	 */
	async linkOAuthAccount(userId, provider, providerAccountId) {
		throw new Error("linkOAuthAccount must be implemented");
	}

	/**
	 * INTERNAL: Get user with password hash (for authentication only)
	 * @param {string} email - Email address
	 * @returns {Promise<Object | null>} Full user object including password
	 * @private
	 */
	async _getUserWithPassword(email) {
		throw new Error("_getUserWithPassword must be implemented");
	}
}
