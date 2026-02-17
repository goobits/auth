/**
 * Base OAuth Provider Interface
 * All OAuth providers must implement these methods
 */
export declare class OAuthProvider {
    name: string;
    config: Record<string, unknown>;
    /**
     * @param {string} name - Provider name (e.g., 'google', 'apple')
     * @param {Object} config - Provider configuration
     */
    constructor(name: string, config: Record<string, unknown>);
    /**
     * Create authorization URL for OAuth flow
     * @param {string} state - CSRF state token
     * @param {string} codeVerifier - PKCE code verifier
     * @param {string[]} scopes - OAuth scopes to request
     * @returns {URL} Authorization URL
     */
    createAuthorizationURL(state: string, codeVerifier: string, scopes: string[]): URL;
    /**
     * Validate authorization code and get user profile + tokens
     * @param {string} code - Authorization code from callback
     * @param {string} codeVerifier - PKCE code verifier
     * @returns {Promise<{profile: import('../types.js').OAuthProfile, tokens: import('../types.js').OAuthTokens}>}
     */
    getUserProfile(code: string, codeVerifier: string, userData?: string | null): Promise<{
        profile: import("../types/index.js").OAuthProfile;
        tokens: import("../types/index.js").OAuthTokens;
    }>;
    /**
     * Refresh access token using refresh token
     * @param {string} refreshToken - OAuth refresh token
     * @returns {Promise<import('../types.js').OAuthTokens>}
     */
    refreshAccessToken(refreshToken: string): Promise<import("../types/index.js").OAuthTokens>;
}
