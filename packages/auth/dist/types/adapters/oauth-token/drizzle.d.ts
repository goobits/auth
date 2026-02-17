import { TokenAdapter } from "./base.js";
import type { OAuthTokens } from "../../types/index.js";
import { type DrizzleDbLike, type DrizzleTable } from "../drizzle-types.js";
type TokensTable = DrizzleTable & {
    userId: DrizzleTable[string];
    provider: DrizzleTable[string];
    tokens: DrizzleTable[string];
};
export declare class DrizzleTokenAdapter extends TokenAdapter {
    private db;
    private tokensTable;
    private encryptionKey;
    private encrypt;
    constructor(db: DrizzleDbLike, options?: {
        tokensTable?: TokensTable;
        encryptionKey?: string | null;
        encrypt?: boolean;
    });
    private getEncryptionKey;
    storeTokens(userId: string, provider: string, tokens: OAuthTokens): Promise<void>;
    getTokens(userId: string, provider: string): Promise<OAuthTokens | null>;
    refreshTokens(_userId: string, _provider: string): Promise<OAuthTokens | null>;
    deleteTokens(userId: string, provider: string): Promise<void>;
}
export {};
