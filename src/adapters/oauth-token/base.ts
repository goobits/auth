/**
 * Base Token Adapter Interface
 * All token adapters must implement these methods
 */
export abstract class TokenAdapter {
	/**
	 * Store OAuth tokens for a user
	 * @param {string} userId - User ID
	 * @param {string} provider - Provider name (e.g., 'google', 'apple')
	 * @param {import('../../types/core.js').OAuthTokens} tokens - OAuth tokens
	 * @returns {Promise<void>}
	 */
	abstract storeTokens(
		userId: string,
		provider: string,
		tokens: import("../../types/core.js").OAuthTokens,
	): Promise<void>;

	/**
	 * Get OAuth tokens for a user
	 * @param {string} userId - User ID
	 * @param {string} provider - Provider name
	 * @returns {Promise<import('../../types/core.js').OAuthTokens | null>}
	 */
	abstract getTokens(
		userId: string,
		provider: string,
	): Promise<import("../../types/core.js").OAuthTokens | null>;

	/**
	 * Refresh OAuth tokens
	 * @param {string} userId - User ID
	 * @param {string} provider - Provider name
	 * @returns {Promise<import('../../types/core.js').OAuthTokens>}
	 */
	abstract refreshTokens(
		userId: string,
		provider: string,
	): Promise<import("../../types/core.js").OAuthTokens | null>;

	/**
	 * Delete OAuth tokens
	 * @param {string} userId - User ID
	 * @param {string} provider - Provider name
	 * @returns {Promise<void>}
	 */
	abstract deleteTokens(userId: string, provider: string): Promise<void>;
}
