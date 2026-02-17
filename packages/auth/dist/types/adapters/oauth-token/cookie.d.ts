import { TokenAdapter } from "./base.js";
import type { Cookies } from "@sveltejs/kit";
import type { OAuthTokens } from "../../types/index.js";
/**
 * Cookie-based Token Adapter
 * Stores encrypted OAuth tokens in cookies (for stateless apps)
 */
export declare class CookieTokenAdapter extends TokenAdapter {
    private cookieName;
    private encryptionKey;
    private secureCookies;
    private maxAge;
    private _cookies;
    /**
     * @param {Object} options - Configuration options
     * @param {string} options.cookieName - Cookie name for storing tokens
     * @param {string} options.encryptionKey - 32-byte hex encryption key
     * @param {boolean} [options.secureCookies=true] - Use secure cookies
     * @param {number} [options.maxAge=604800] - Cookie max age in seconds (default: 7 days)
     */
    constructor(options?: {
        cookieName?: string;
        encryptionKey?: string;
        secureCookies?: boolean;
        maxAge?: number;
    });
    /**
     * Set the cookies object for this adapter
     * @param {import('@sveltejs/kit').Cookies} cookies
     */
    _setCookies(cookies: Cookies): void;
    storeTokens(userId: string, provider: string, tokens: Record<string, unknown>): Promise<void>;
    getTokens(userId: string, provider: string): Promise<OAuthTokens | null>;
    refreshTokens(userId: string, provider: string): Promise<import("../../types/index.js").OAuthTokens | null>;
    deleteTokens(userId: string, provider: string): Promise<void>;
}
