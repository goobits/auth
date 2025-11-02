/**
 * Base Token Adapter Interface
 * All token adapters must implement these methods
 */
export class TokenAdapter {
	/**
	 * Store OAuth tokens for a user
	 * @param {string} userId - User ID
	 * @param {string} provider - Provider name (e.g., 'google', 'apple')
	 * @param {import('../../types').OAuthTokens} tokens - OAuth tokens
	 * @returns {Promise<void>}
	 */
	async storeTokens(userId, provider, tokens) {
		throw new Error("storeTokens must be implemented");
	}

	/**
	 * Get OAuth tokens for a user
	 * @param {string} userId - User ID
	 * @param {string} provider - Provider name
	 * @returns {Promise<import('../../types').OAuthTokens | null>}
	 */
	async getTokens(userId, provider) {
		throw new Error("getTokens must be implemented");
	}

	/**
	 * Refresh OAuth tokens
	 * @param {string} userId - User ID
	 * @param {string} provider - Provider name
	 * @returns {Promise<import('../../types').OAuthTokens>}
	 */
	async refreshTokens(userId, provider) {
		throw new Error("refreshTokens must be implemented");
	}

	/**
	 * Delete OAuth tokens
	 * @param {string} userId - User ID
	 * @param {string} provider - Provider name
	 * @returns {Promise<void>}
	 */
	async deleteTokens(userId, provider) {
		throw new Error("deleteTokens must be implemented");
	}
}
