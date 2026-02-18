import type { OAuthProfile, User } from "../../types/core.js";

/**
 * Base Database Adapter Interface
 * All database adapters must implement these methods
 */
export abstract class UserAdapter {
	/**
	 * Create a new user (returns SANITIZED user)
	 * @param {import('../../types/core.js').OAuthProfile} profile - OAuth profile
	 * @param {Object} [metadata] - Additional user metadata
	 * @returns {Promise<import('../../types/core.js').User>}
	 */
	abstract createUser(
		profile: OAuthProfile,
		metadata?: Record<string, unknown>,
	): Promise<User>;

	/**
	 * Get user by ID (returns SANITIZED user)
	 * @param {string} id - User ID
	 * @returns {Promise<import('../../types/core.js').User | null>}
	 */
	abstract getUserById(id: string): Promise<User | null>;

	/**
	 * Get user by email (returns SANITIZED user)
	 * @param {string} email - Email address
	 * @returns {Promise<import('../../types/core.js').User | null>}
	 */
	abstract getUserByEmail(email: string): Promise<User | null>;

	/**
	 * Get user by OAuth provider ID (returns SANITIZED user)
	 * @param {string} provider - Provider name (e.g., 'google', 'apple')
	 * @param {string} providerId - Provider-specific user ID
	 * @returns {Promise<import('../../types/core.js').User | null>}
	 */
	abstract getUserByProviderId(
		provider: string,
		providerId: string,
	): Promise<User | null>;

	/**
	 * Update user (returns SANITIZED user)
	 * @param {string} id - User ID
	 * @param {Partial<import('../../types/core.js').User>} data - Fields to update
	 * @returns {Promise<import('../../types/core.js').User>}
	 */
	abstract updateUser(
		id: string,
		data: Partial<User> & Record<string, unknown>,
	): Promise<User>;

	/**
	 * Delete user
	 * @param {string} id - User ID
	 * @returns {Promise<void>}
	 */
	abstract deleteUser(id: string): Promise<void>;

	/**
	 * Link OAuth account to user
	 * @param {string} userId - User ID
	 * @param {string} provider - Provider name
	 * @param {string} providerAccountId - Provider account ID
	 * @returns {Promise<void>}
	 */
	abstract linkOAuthAccount(
		userId: string,
		provider: string,
		providerAccountId: string,
	): Promise<void>;

	/**
	 * INTERNAL: Get user with password hash (for authentication only)
	 * @param {string} email - Email address
	 * @returns {Promise<Object | null>} Full user object including password
	 * @private
	 */
	abstract getUserWithPasswordHash(
		email: string,
	): Promise<(User & { password?: string | null }) | null>;

	/**
	 * OPTIONAL: Get user by identifier (returns SANITIZED user)
	 * @param {string} identifier - Identifier value (e.g. nickname)
	 * @param {string} [field] - Identifier field name
	 * @returns {Promise<import('../../types/core.js').User | null>}
	 */
	getUserByIdentifier?(
		identifier: string,
		field?: string,
	): Promise<User | null>;

	/**
	 * OPTIONAL: Get user with password hash by identifier (for auth only)
	 * @param {string} identifier - Identifier value (e.g. nickname)
	 * @param {string} [field] - Identifier field name
	 * @returns {Promise<Object | null>} Full user object including password
	 */
	getUserWithPasswordHashByIdentifier?(
		identifier: string,
		field?: string,
	): Promise<(User & { password?: string | null }) | null>;
}
