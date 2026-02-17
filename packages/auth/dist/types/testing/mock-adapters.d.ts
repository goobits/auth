import { SessionAdapter } from "../adapters/session/base.js";
import { UserAdapter } from "../adapters/database/base.js";
import { TokenAdapter } from "../adapters/oauth-token/base.js";
import type { OAuthProfile, OAuthTokens, Session, User } from "../types/index.js";
export declare class MockSessionAdapter extends SessionAdapter {
    private sessions;
    private users;
    setUser(user: User): void;
    createSession(userId: string): Promise<Session>;
    validateSession(sessionId: string): Promise<{
        session: Session | null;
        user: User | null;
    }>;
    invalidateSession(sessionId: string): Promise<void>;
    invalidateUserSessions(userId: string): Promise<void>;
    listSessions(userId: string): Promise<Session[]>;
    setSessionCookie(): void;
    deleteSessionCookie(): void;
}
export declare class MockUserAdapter extends UserAdapter {
    private users;
    private oauthIndex;
    createUser(profile: OAuthProfile, metadata?: Record<string, unknown>): Promise<User>;
    getUserById(id: string): Promise<User | null>;
    getUserByEmail(email: string): Promise<User | null>;
    getUserByProviderId(provider: string, providerId: string): Promise<User | null>;
    updateUser(id: string, data: Partial<User> & Record<string, unknown>): Promise<User>;
    deleteUser(id: string): Promise<void>;
    linkOAuthAccount(userId: string, provider: string, providerAccountId: string): Promise<void>;
    getUserWithPasswordHash(email: string): Promise<(User & {
        password?: string | null;
    }) | null>;
    private sanitize;
}
export declare class MockTokenAdapter extends TokenAdapter {
    private tokens;
    storeTokens(userId: string, provider: string, tokens: OAuthTokens): Promise<void>;
    getTokens(userId: string, provider: string): Promise<OAuthTokens | null>;
    refreshTokens(userId: string, provider: string): Promise<OAuthTokens | null>;
    deleteTokens(userId: string, provider: string): Promise<void>;
}
