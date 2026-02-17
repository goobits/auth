import { SessionAdapter } from "./base.js";
import type { Cookies } from "@sveltejs/kit";
import type { Session, User } from "../../types/index.js";
type D1Value = string | number | boolean | null;
type D1Row = Record<string, D1Value>;
type D1DatabaseLike = {
    prepare: (sql: string) => {
        bind: (...args: D1Value[]) => {
            run: () => Promise<unknown>;
            first: () => Promise<D1Row | null>;
            all: () => Promise<{
                results?: D1Row[];
            }>;
        };
    };
};
type D1SessionOptions = {
    sessionsTable?: string;
    usersTable?: string;
    sessionLifetime?: number;
    sessionRefreshThreshold?: number;
    cookieName?: string;
    secureCookies?: boolean;
    sanitizeUser?: (user: User | null) => User | null;
    columns?: Partial<{
        sessionId: string;
        userId: string;
        expiresAt: string;
        createdAt: string | null;
        lastActiveAt: string | null;
        ip: string | null;
        userAgent: string | null;
    }>;
    userColumns?: Partial<{
        id: string;
        email: string;
        name: string;
        avatar: string;
        password: string;
        emailVerified: string;
        role: string;
        settings: string;
        createdAt: string;
        updatedAt: string;
    }>;
};
export declare class D1SessionAdapter extends SessionAdapter {
    private db;
    private sessionsTable;
    private usersTable;
    private sessionLifetime;
    private sessionRefreshThreshold;
    private cookieName;
    private secureCookies;
    private sanitizeUser;
    private columns;
    private userColumns;
    constructor(db: D1DatabaseLike, options?: D1SessionOptions);
    _defaultSanitizeUser(user: User | null): User | null;
    _generateSessionId(): string;
    private _coerceDbId;
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
            id: string;
            userId: string;
            expiresAt: Date;
            fresh: boolean;
        };
        user: User | null;
    }>;
    _mapUserRow(row: D1Row): User | null;
    invalidateSession(sessionId: string): Promise<void>;
    invalidateUserSessions(userId: string): Promise<void>;
    listSessions(userId: string): Promise<Session[]>;
    setSessionCookie(cookies: Cookies, session: {
        id: string;
        expiresAt: Date;
    }): void;
    deleteSessionCookie(cookies: Cookies): void;
}
export {};
