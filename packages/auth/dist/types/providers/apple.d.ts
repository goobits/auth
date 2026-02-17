import { OAuthProvider } from "./base.js";
import type { OAuthProfile, OAuthTokens } from "../types/index.js";
type AppleProviderConfig = {
    clientId: string;
    teamId: string;
    keyId: string;
    privateKey: string;
    callbackUrl: string;
};
/**
 * Apple OAuth Provider
 * Implements Sign in with Apple
 */
export declare class AppleProvider extends OAuthProvider {
    private client;
    private readTokenValue;
    /**
     * @param {Object} config - Configuration
     * @param {string} config.clientId - Apple Services ID
     * @param {string} config.teamId - Apple Team ID
     * @param {string} config.keyId - Apple Key ID
     * @param {string} config.privateKey - Apple Private Key (base64 encoded)
     * @param {string} config.callbackUrl - OAuth callback URL
     */
    constructor(config: AppleProviderConfig);
    /**
     * Decode base64 private key
     * @param {string} privateKey - Base64 encoded private key
     * @returns {Uint8Array}
     * @private
     */
    _decodePrivateKey(privateKey: string): Uint8Array;
    createAuthorizationURL(state: string, codeVerifier: string, scopes?: string[]): URL;
    /**
     * Get user profile from Apple
     * @param {string} code - Authorization code
     * @param {string} codeVerifier - PKCE code verifier
     * @param {string} [userData] - Optional user data from first-time sign in (JSON string)
     * @returns {Promise<{profile: Object, tokens: Object}>}
     */
    getUserProfile(code: string, codeVerifier: string, userData?: string | null): Promise<{
        profile: OAuthProfile;
        tokens: OAuthTokens;
    }>;
    refreshAccessToken(refreshToken: string): Promise<OAuthTokens>;
}
export {};
