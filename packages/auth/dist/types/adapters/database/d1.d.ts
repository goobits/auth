import { UserAdapter } from "./base.js";
import type { User } from "../../types/index.js";
type D1Value = string | number | boolean | null;
type D1Row = Record<string, D1Value>;
type D1DatabaseLike = {
    prepare: (sql: string) => {
        bind: (...args: D1Value[]) => {
            run: () => Promise<{
                meta?: {
                    last_row_id?: string | number;
                };
            } | undefined>;
            first: () => Promise<D1Row | null>;
        };
    };
};
type D1UserAdapterOptions = {
    usersTable?: string;
    oauthAccountsTable?: string;
    sanitizeUser?: (user: User | null) => User | null;
    columns?: Partial<Record<string, string>>;
    oauthColumns?: Partial<Record<string, string>>;
    allowedFields?: string[];
};
export declare class D1UserAdapter extends UserAdapter {
    db: D1DatabaseLike;
    usersTable: string;
    oauthAccountsTable: string;
    sanitizeUser: (user: User | null) => User | null;
    columns: {
        id: string;
        email: string;
        name: string;
        avatar: string;
        emailVerified: string;
        password: string;
        role: string;
        settings: string;
        createdAt: string;
        updatedAt: string;
    };
    oauthColumns: {
        userId: string;
        provider: string;
        providerAccountId: string;
    };
    allowedFields: string[];
    constructor(db: D1DatabaseLike, options?: D1UserAdapterOptions);
    private mapUser;
    _defaultSanitizeUser(user: User | null): User | null;
    private mapFieldToColumn;
    private coerceDbValue;
    createUser(profile: {
        email: string;
        name?: string;
        picture?: string;
        verified_email?: boolean;
    }, metadata?: Record<string, unknown>): Promise<User>;
    getUserById(id: string, rawId?: string | number): Promise<User | null>;
    getUserByEmail(email: string): Promise<User | null>;
    getUserByProviderId(provider: string, providerId: string): Promise<User | null>;
    updateUser(id: string, data: Partial<User> & Record<string, unknown>): Promise<User>;
    deleteUser(id: string): Promise<void>;
    linkOAuthAccount(userId: string, provider: string, providerAccountId: string): Promise<void>;
    getUserWithPasswordHash(email: string): Promise<(User & {
        password?: string | null;
    }) | null>;
}
export {};
