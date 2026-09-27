/**
 * Base Token Adapter Interface
 * All token adapters must implement these methods
 */
export abstract class TokenAdapter {
	/**
	 * Store OAuth tokens for a user
	 * @param {string} userId - User ID
	 * @param {string} provider - Provider name (e.g., 'google', 'apple')
	 * @param {import('../../types/core.ts').OAuthTokens} tokens - OAuth tokens
	 * @returns {Promise<void>}
	 */
	abstract storeTokens(
		userId: string,
		provider: string,
		tokens: import('../../types/core.ts').OAuthTokens
	): Promise<void>

	/**
	 * Get OAuth tokens for a user
	 * @param {string} userId - User ID
	 * @param {string} provider - Provider name
	 * @returns {Promise<import('../../types/core.ts').OAuthTokens | null>}
	 */
	abstract getTokens(
		userId: string,
		provider: string
	): Promise<import('../../types/core.ts').OAuthTokens | null>

	/**
	 * @deprecated Token persistence cannot refresh provider credentials. Call
	 * `OAuthProvider.refreshAccessToken()` and persist the returned tokens with
	 * `storeTokens()`.
	 *
	 * @param {string} userId - User ID
	 * @param {string} provider - Provider name
	 * @throws Always. Retained temporarily for source compatibility.
	 */
	async refreshTokens(
		_userId: string,
		_provider: string
	): Promise<import('../../types/core.ts').OAuthTokens | null> {
		throw new Error(
			'TokenAdapter.refreshTokens is unsupported; call OAuthProvider.refreshAccessToken and storeTokens'
		)
	}

	/**
	 * Delete OAuth tokens
	 * @param {string} userId - User ID
	 * @param {string} provider - Provider name
	 * @returns {Promise<void>}
	 */
	abstract deleteTokens(userId: string, provider: string): Promise<void>
}
