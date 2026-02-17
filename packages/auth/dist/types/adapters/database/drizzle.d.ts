import { UserAdapter } from "./base.js";
import type { OAuthProfile, User } from "../../types/index.js";
import { type DrizzleDbLike, type DrizzleJson, type DrizzleTable } from "../drizzle-types.js";
type UsersTable = DrizzleTable & {
    id: DrizzleTable[string];
    email: DrizzleTable[string];
    name: DrizzleTable[string];
    avatar?: DrizzleTable[string];
    emailVerified?: DrizzleTable[string];
    password?: DrizzleTable[string];
};
type OAuthAccountsTable = DrizzleTable & {
    userId: DrizzleTable[string];
    provider: DrizzleTable[string];
    providerAccountId: DrizzleTable[string];
};
export declare class DrizzleUserAdapter extends UserAdapter {
    private db;
    private usersTable;
    private oauthAccountsTable;
    private sanitizeUser;
    constructor(db: DrizzleDbLike, options?: {
        usersTable?: UsersTable;
        oauthAccountsTable?: OAuthAccountsTable;
        sanitizeUser?: (user: User | null) => User | null;
    });
    _defaultSanitizeUser(user: User | null): User | null;
    createUser(profile: OAuthProfile, metadata?: Record<string, DrizzleJson>): Promise<User>;
    getUserById(id: string): Promise<User | null>;
    getUserByEmail(email: string): Promise<User | null>;
    getUserByProviderId(provider: string, providerId: string): Promise<User | null>;
    updateUser(id: string, data: Partial<User> & Record<string, DrizzleJson>): Promise<User>;
    deleteUser(id: string): Promise<void>;
    linkOAuthAccount(userId: string, provider: string, providerAccountId: string): Promise<void>;
    getUserWithPasswordHash(email: string): Promise<(User & {
        password?: string | null;
    }) | null>;
}
export {};
