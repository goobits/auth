// @ts-nocheck
import type { OAuthProfile, User } from "../../types/index.ts";

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
	async createUser(
		profile: OAuthProfile,
		metadata: Record<string, unknown> = {},
	): Promise<User> {
		throw new Error("createUser must be implemented");
	}

	/**
	 * Get user by ID (returns SANITIZED user)
	 * @param {string} id - User ID
	 * @returns {Promise<import('../../types').User | null>}
	 */
	async getUserById(id: string): Promise<User | null> {
		throw new Error("getUserById must be implemented");
	}

	/**
	 * Get user by email (returns SANITIZED user)
	 * @param {string} email - Email address
	 * @returns {Promise<import('../../types').User | null>}
	 */
	async getUserByEmail(email: string): Promise<User | null> {
		throw new Error("getUserByEmail must be implemented");
	}

	/**
	 * Get user by OAuth provider ID (returns SANITIZED user)
	 * @param {string} provider - Provider name (e.g., 'google', 'apple')
	 * @param {string} providerId - Provider-specific user ID
	 * @returns {Promise<import('../../types').User | null>}
	 */
	async getUserByProviderId(
		provider: string,
		providerId: string,
	): Promise<User | null> {
		throw new Error("getUserByProviderId must be implemented");
	}

	/**
	 * Update user (returns SANITIZED user)
	 * @param {string} id - User ID
	 * @param {Partial<import('../../types').User>} data - Fields to update
	 * @returns {Promise<import('../../types').User>}
	 */
	async updateUser(
		id: string,
		data: Partial<User> & Record<string, unknown>,
	): Promise<User> {
		throw new Error("updateUser must be implemented");
	}

	/**
	 * Delete user
	 * @param {string} id - User ID
	 * @returns {Promise<void>}
	 */
	async deleteUser(id: string): Promise<void> {
		throw new Error("deleteUser must be implemented");
	}

	/**
	 * Link OAuth account to user
	 * @param {string} userId - User ID
	 * @param {string} provider - Provider name
	 * @param {string} providerAccountId - Provider account ID
	 * @returns {Promise<void>}
	 */
	async linkOAuthAccount(
		userId: string,
		provider: string,
		providerAccountId: string,
	): Promise<void> {
		throw new Error("linkOAuthAccount must be implemented");
	}

	/**
	 * INTERNAL: Get user with password hash (for authentication only)
	 * @param {string} email - Email address
	 * @returns {Promise<Object | null>} Full user object including password
	 * @private
	 */
	async _getUserWithPassword(
		email: string,
	): Promise<(User & { password?: string | null }) | null> {
		throw new Error("_getUserWithPassword must be implemented");
	}
}
