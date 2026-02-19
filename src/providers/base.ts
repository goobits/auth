/**
 * Base OAuth Provider Interface
 * All OAuth providers must implement these methods
 */
export class OAuthProvider {
	name: string;
	config: Record<string, unknown>;

	/**
	 * @param {string} name - Provider name (e.g., 'google', 'apple')
	 * @param {Object} config - Provider configuration
	 */
	constructor(name: string, config: Record<string, unknown>) {
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
	createAuthorizationURL(
		state: string,
		codeVerifier: string,
		scopes: string[],
	): URL {
		throw new Error("createAuthorizationURL must be implemented");
	}

	/**
	 * Validate authorization code and get user profile + tokens
	 * @param {string} code - Authorization code from callback
	 * @param {string} codeVerifier - PKCE code verifier
	 * @returns {Promise<{profile: import('../types/core.js').OAuthProfile, tokens: import('../types/core.js').OAuthTokens}>}
	 */
	async getUserProfile(
		code: string,
		codeVerifier: string,
		userData?: string | null,
	): Promise<{
		profile: import("../types/core.js").OAuthProfile;
		tokens: import("../types/core.js").OAuthTokens;
	}> {
		throw new Error("getUserProfile must be implemented");
	}

	/**
	 * Refresh access token using refresh token
	 * @param {string} refreshToken - OAuth refresh token
	 * @returns {Promise<import('../types/core.js').OAuthTokens>}
	 */
	async refreshAccessToken(
		refreshToken: string,
	): Promise<import("../types/core.js").OAuthTokens> {
		throw new Error("refreshAccessToken must be implemented");
	}
}
