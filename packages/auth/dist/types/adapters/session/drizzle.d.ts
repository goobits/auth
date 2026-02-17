import { SessionAdapter } from "./base.js";
import type { Cookies } from "@sveltejs/kit";
import type { Session, User } from "../../types/index.js";
import type { DrizzleDbLike, DrizzleJson, DrizzleTable } from "../drizzle-types.js";
type SessionsTable = DrizzleTable & {
    id: DrizzleTable[string];
    userId: DrizzleTable[string];
    expiresAt: DrizzleTable[string];
    createdAt?: DrizzleTable[string];
    lastActiveAt?: DrizzleTable[string];
    ip?: DrizzleTable[string];
    userAgent?: DrizzleTable[string];
};
type UsersTable = DrizzleTable & {
    id: DrizzleTable[string];
    email: DrizzleTable[string];
    name: DrizzleTable[string];
    avatar?: DrizzleTable[string];
    emailVerified?: DrizzleTable[string];
};
export declare class DrizzleSessionAdapter extends SessionAdapter {
    private db;
    private sessionsTable;
    private usersTable;
    private sessionLifetime;
    private sessionRefreshThreshold;
    private cookieName;
    private secureCookies;
    private sanitizeUser;
    constructor(db: DrizzleDbLike, options?: {
        sessionsTable?: SessionsTable;
        usersTable?: UsersTable;
        sessionLifetime?: number;
        sessionRefreshThreshold?: number;
        cookieName?: string;
        secureCookies?: boolean;
        sanitizeUser?: (user: User | null) => User | null;
    });
    _defaultSanitizeUser(user: User | null): User | null;
    _generateSessionId(): string;
    createSession(userId: string, metadata?: Record<string, DrizzleJson>): Promise<Session>;
    validateSession(sessionId: string): Promise<{
        session: Session | null;
        user: User | null;
    }>;
    invalidateSession(sessionId: string): Promise<void>;
    invalidateUserSessions(userId: string): Promise<void>;
    listSessions(userId: string): Promise<Session[]>;
    setSessionCookie(cookies: Cookies, session: Session): void;
    deleteSessionCookie(cookies: Cookies): void;
}
export {};
