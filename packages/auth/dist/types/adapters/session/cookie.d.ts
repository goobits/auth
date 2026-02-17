import { SessionAdapter } from "./base.js";
import type { Cookies } from "@sveltejs/kit";
/**
 * Cookie-based Session Adapter
 * Simple session management using cookies only (no database)
 * Best for stateless applications or serverless deployments
 */
export declare class CookieSessionAdapter extends SessionAdapter {
    private cookieName;
    private secureCookies;
    private sessionLifetime;
    private _sessions;
    /**
     * @param {Object} options - Configuration options
     * @param {string} [options.cookieName='session'] - Session cookie name
     * @param {boolean} [options.secureCookies=true] - Use secure cookies
     * @param {number} [options.sessionLifetime=2592000000] - Session lifetime in ms (default: 30 days)
     */
    constructor(options?: {
        cookieName?: string;
        secureCookies?: boolean;
        sessionLifetime?: number;
    });
    /**
     * Generate cryptographically secure session ID
     * @returns {string}
     * @private
     */
    _generateSessionId(): string;
    createSession(userId: string, metadata?: Record<string, unknown>): Promise<{
        id: string;
        userId: string;
        expiresAt: Date;
    }>;
    validateSession(sessionId: string): Promise<{
        session: null;
        user: null;
    } | {
        session: {
            [key: string]: unknown;
            id: string;
            userId: string;
            expiresAt: Date;
        };
        user: null;
    }>;
    invalidateSession(sessionId: string): Promise<void>;
    invalidateUserSessions(userId: string): Promise<void>;
    listSessions(userId: string): Promise<{
        [key: string]: unknown;
        id: string;
        userId: string;
        expiresAt: Date;
    }[]>;
    setSessionCookie(cookies: Cookies, session: {
        id: string;
        expiresAt: Date;
    }): void;
    deleteSessionCookie(cookies: Cookies): void;
}
