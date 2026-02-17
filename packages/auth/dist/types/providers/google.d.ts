import { OAuthProvider } from "./base.js";
import type { OAuthProfile, OAuthTokens } from "../types/index.js";
type GoogleProviderConfig = {
    clientId: string;
    clientSecret: string;
    callbackUrl: string;
    scopes?: string[];
};
/**
 * Google OAuth Provider
 * Implements OAuth 2.0 authentication with Google
 */
export declare class GoogleProvider extends OAuthProvider {
    private client;
    private defaultScopes;
    private readTokenValue;
    /**
     * @param {Object} config - Configuration
     * @param {string} config.clientId - Google OAuth client ID
     * @param {string} config.clientSecret - Google OAuth client secret
     * @param {string} config.callbackUrl - OAuth callback URL
     * @param {string[]} [config.scopes] - Default OAuth scopes
     */
    constructor(config: GoogleProviderConfig);
    createAuthorizationURL(state: string, codeVerifier: string, scopes?: string[]): URL;
    getUserProfile(code: string, codeVerifier: string): Promise<{
        profile: OAuthProfile;
        tokens: OAuthTokens;
    }>;
    refreshAccessToken(refreshToken: string): Promise<OAuthTokens>;
}
export {};
