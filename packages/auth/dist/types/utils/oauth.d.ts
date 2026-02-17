import type { RequestEvent } from "@sveltejs/kit";
import type { Cookies } from "@sveltejs/kit";
import type { OAuthProvider } from "../providers/base.js";
import type { OAuthProfile, OAuthTokens } from "../types/index.js";
import type { RequestEventLike } from "../types/auth.js";
type CookiesLike = Pick<Cookies, "set" | "get" | "delete">;
type CookieOptions = {
    secure?: boolean;
    maxAge?: number;
    sameSite?: "lax" | "strict" | "none";
};
type OAuthCallbackParams = {
    code: string | null;
    state: string | null;
    storedState: string | null;
    storedCodeVerifier: string | null;
};
type OAuthCallbackOverrides = {
    code?: string | null;
    state?: string | null;
};
type OAuthCallbackHandlers = {
    onAuthenticated?: (profile: OAuthProfile, tokens: OAuthTokens) => Promise<void> | void;
    onError?: (error: unknown) => Promise<void> | void;
};
/**
 * Create OAuth state and code verifier cookies
 * @param {Object} cookies - SvelteKit cookies object
 * @param {string} provider - Provider name (e.g., 'google', 'apple')
 * @param {Object} options - Cookie options
 * @param {boolean} [options.secure=true] - Use secure cookies
 * @param {number} [options.maxAge=1800] - Cookie max age in seconds (default 30 min)
 * @returns {{state: string, codeVerifier: string}}
 */
export declare function createOAuthCookies(cookies: CookiesLike, provider: string, options?: CookieOptions): {
    state: string;
    codeVerifier: string;
};
/**
 * Clean up OAuth cookies after authentication
 * @param {Object} cookies - SvelteKit cookies object
 * @param {string} provider - Provider name
 */
export declare function cleanupOAuthCookies(cookies: CookiesLike, provider: string): void;
/**
 * Validate OAuth callback parameters
 * @param {Object} params - Callback parameters
 * @param {string} params.code - Authorization code from provider
 * @param {string} params.state - State from callback
 * @param {string} params.storedState - State from cookies
 * @param {string} params.storedCodeVerifier - Code verifier from cookies
 * @returns {boolean}
 */
export declare function validateOAuthCallback(params: OAuthCallbackParams): boolean;
/**
 * Extract OAuth callback parameters from request
 * @param {Object} cookies - SvelteKit cookies object
 * @param {URL} url - Request URL
 * @param {string} provider - Provider name
 * @returns {{code: string | null, state: string | null, storedState: string | null, storedCodeVerifier: string | null}}
 */
export declare function getOAuthCallbackParams(cookies: CookiesLike, url: URL, provider: string, overrides?: OAuthCallbackOverrides): OAuthCallbackParams;
/**
 * Create a generic OAuth callback handler
 * This handles the full OAuth flow including validation, profile fetching, and cleanup
 *
 * @param {Object} params
 * @param {import('@sveltejs/kit').RequestEvent} params.event - SvelteKit request event
 * @param {string} params.provider - Provider name
 * @param {import('../providers/base.js').OAuthProvider} params.providerInstance - Provider instance
 * @param {Object} params.callbacks - Lifecycle callbacks
 * @param {Function} params.callbacks.onAuthenticated - Called with (profile, tokens) after successful auth
 * @param {Function} [params.callbacks.onError] - Optional error handler
 * @param {string} [params.appleUserData] - Optional Apple user data from POST body
 * @returns {Promise<{profile: Object, tokens: Object}>}
 */
export declare function handleOAuthCallback({ event, provider, providerInstance, callbacks, appleUserData, overrideParams, }: {
    event: RequestEvent | RequestEventLike | {
        cookies: CookiesLike;
        url: URL;
        request: Request;
    };
    provider: string;
    providerInstance: OAuthProvider;
    callbacks: OAuthCallbackHandlers;
    appleUserData?: string | null;
    overrideParams?: OAuthCallbackOverrides | null;
}): Promise<{
    profile: OAuthProfile;
    tokens: OAuthTokens;
}>;
export {};
