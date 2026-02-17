import { SessionAdapter } from "./base.js";
import type { Cookies } from "@sveltejs/kit";
import type { Session, User } from "../../types/index.js";
type KVNamespaceLike = {
    put: (key: string, value: string, options?: {
        expirationTtl?: number;
    }) => Promise<void>;
    get: (key: string, options?: {
        type?: "json" | "text";
    }) => Promise<Record<string, unknown> | string | null>;
    delete: (key: string) => Promise<void>;
    list?: (options?: {
        prefix?: string;
    }) => Promise<{
        keys?: Array<{
            name: string;
        }>;
    }>;
};
export declare class KVSessionAdapter extends SessionAdapter {
    private namespace;
    private sessionLifetime;
    private sessionRefreshThreshold;
    private cookieName;
    private secureCookies;
    private getUserById;
    private sanitizeUser;
    private keyPrefix;
    constructor(namespace: KVNamespaceLike, options?: {
        sessionLifetime?: number;
        sessionRefreshThreshold?: number;
        cookieName?: string;
        secureCookies?: boolean;
        getUserById?: (id: string) => Promise<User | null>;
        sanitizeUser?: (user: User | null) => User | null;
        keyPrefix?: string;
    });
    _defaultSanitizeUser(user: User | null): User | null;
    _key(sessionId: string): string;
    createSession(userId: string, metadata?: Record<string, unknown>): Promise<{
        id: string;
        userId: string;
        expiresAt: Date;
    }>;
    validateSession(sessionId: string): Promise<{
        session: Session | null;
        user: User | null;
    }>;
    invalidateSession(sessionId: string): Promise<void>;
    invalidateUserSessions(_userId: string): Promise<void>;
    listSessions(userId: string): Promise<Session[]>;
    setSessionCookie(cookies: Cookies, session: {
        id: string;
        expiresAt: Date;
    }): void;
    deleteSessionCookie(cookies: Cookies): void;
}
export {};
