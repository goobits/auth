import type { OAuthProfile, User } from '../../types/core.ts'

/**
 * Base Database Adapter Interface
 * All database adapters must implement these methods
 */
export abstract class UserAdapter {
	/**
	 * Create a new user (returns SANITIZED user)
	 * @param {import('../../types/core.ts').OAuthProfile} profile - OAuth profile
	 * @param {Object} [metadata] - Additional user metadata
	 * @returns {Promise<import('../../types/core.ts').User>}
	 */
	abstract createUser(profile: OAuthProfile, metadata?: Record<string, unknown>): Promise<User>

	/**
	 * Get user by ID (returns SANITIZED user)
	 * @param {string} id - User ID
	 * @returns {Promise<import('../../types/core.ts').User | null>}
	 */
	abstract getUserById(id: string): Promise<User | null>

	/**
	 * Get user by email (returns SANITIZED user)
	 * @param {string} email - Email address
	 * @returns {Promise<import('../../types/core.ts').User | null>}
	 */
	abstract getUserByEmail(email: string): Promise<User | null>

	/**
	 * Update user (returns SANITIZED user)
	 * @param {string} id - User ID
	 * @param {Partial<import('../../types/core.ts').User>} data - Fields to update
	 * @returns {Promise<import('../../types/core.ts').User>}
	 */
	abstract updateUser(id: string, data: Partial<User> & Record<string, unknown>): Promise<User>

	/**
	 * Delete user
	 * @param {string} id - User ID
	 * @returns {Promise<void>}
	 */
	abstract deleteUser(id: string): Promise<void>

	/**
	 * OPTIONAL: Get user by identifier (returns SANITIZED user)
	 * @param {string} identifier - Identifier value (e.g. nickname)
	 * @param {string} [field] - Identifier field name
	 * @returns {Promise<import('../../types/core.ts').User | null>}
	 */
	getUserByIdentifier?(identifier: string, field?: string): Promise<User | null>
}
