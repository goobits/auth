/**
 * Base OAuth Provider Interface
 * All OAuth providers must implement these methods
 */
export class OAuthProvider {
	/**
	 * @param {string} name - Provider name (e.g., 'google', 'apple')
	 * @param {Object} config - Provider configuration
	 */
	constructor(name, config) {
		this.name = name;
		this.config = config;
	}

	/**
	 * Create authorization URL for OAuth flow
	 * @param {string} state - CSRF state token
	 * @param {string} codeVerifier - PKCE code verifier
	 * @param {string[]} scopes - OAuth scopes to request
	 * @returns {URL} Authorization URL
	 */
	createAuthorizationURL(state, codeVerifier, scopes) {
		throw new Error("createAuthorizationURL must be implemented");
	}

	/**
	 * Validate authorization code and get user profile + tokens
	 * @param {string} code - Authorization code from callback
	 * @param {string} codeVerifier - PKCE code verifier
	 * @returns {Promise<{profile: import('../types').OAuthProfile, tokens: import('../types').OAuthTokens}>}
	 */
	async getUserProfile(code, codeVerifier) {
		throw new Error("getUserProfile must be implemented");
	}

	/**
	 * Refresh access token using refresh token
	 * @param {string} refreshToken - OAuth refresh token
	 * @returns {Promise<import('../types').OAuthTokens>}
	 */
	async refreshAccessToken(refreshToken) {
		throw new Error("refreshAccessToken must be implemented");
	}
}
