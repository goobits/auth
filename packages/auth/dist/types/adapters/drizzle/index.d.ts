import { DrizzleUserAdapter } from "../database/drizzle.js";
import { DrizzleSessionAdapter } from "../session/drizzle.js";
import { DrizzleTokenAdapter } from "../oauth-token/drizzle.js";
import { DrizzleVerificationTokenAdapter } from "../verification-token/drizzle-verification.js";
import { DrizzleMagicLinkAdapter } from "../magic-link/drizzle.js";
import { DrizzleWebAuthnAdapter } from "../webauthn/drizzle.js";
import type { DrizzleDbLike, DrizzleTable } from "../drizzle-types.js";
import type { User } from "../../types/index.js";
type TableKey = "users" | "sessions" | "oauthTokens" | "oauthAccounts" | "verificationTokens" | "magicLinkTokens" | "webauthnCredentials" | "webauthnChallenges";
export type DrizzleAuthSchema = Partial<Record<TableKey, DrizzleTable>>;
export type DrizzleAdapterOptions<TSchema extends DrizzleAuthSchema = DrizzleAuthSchema> = {
    schema?: TSchema;
    tables?: Partial<Record<TableKey, DrizzleTable>>;
    oauthTokenEncryptionKey?: string | null;
    oauthTokenEncrypt?: boolean;
    session?: {
        sessionLifetime?: number;
        sessionRefreshThreshold?: number;
        cookieName?: string;
        secureCookies?: boolean;
    };
    sanitizeUser?: (user: User | null) => User | null;
};
export type DrizzleAdapterBundle = {
    session: DrizzleSessionAdapter;
    user: DrizzleUserAdapter;
    oauthToken?: DrizzleTokenAdapter;
    verificationToken?: DrizzleVerificationTokenAdapter;
    magicLink?: DrizzleMagicLinkAdapter;
    webauthn?: DrizzleWebAuthnAdapter;
};
export declare function drizzleAdapter<TSchema extends DrizzleAuthSchema = DrizzleAuthSchema>(db: DrizzleDbLike, options?: DrizzleAdapterOptions<TSchema>): DrizzleAdapterBundle;
export {};
