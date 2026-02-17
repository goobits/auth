import { TokenAdapter } from "./base.js";
import type { OAuthTokens } from "../../types/index.js";
type D1Value = string | number | boolean | null;
type D1Row = Record<string, D1Value>;
type D1DatabaseLike = {
    prepare: (sql: string) => {
        bind: (...args: D1Value[]) => {
            run: () => Promise<void>;
            first: () => Promise<D1Row | null>;
        };
    };
};
export declare class D1TokenAdapter extends TokenAdapter {
    private db;
    private tokensTable;
    private encrypt;
    private encryptionKey;
    private columns;
    constructor(db: D1DatabaseLike, options?: {
        tokensTable?: string;
        encrypt?: boolean;
        encryptionKey?: string | null;
        columns?: Partial<Record<string, string>>;
    });
    storeTokens(userId: string, provider: string, tokens: Record<string, unknown>): Promise<void>;
    getTokens(userId: string, provider: string): Promise<OAuthTokens | null>;
    refreshTokens(userId: string, provider: string): Promise<OAuthTokens | null>;
    deleteTokens(userId: string, provider: string): Promise<void>;
}
export {};
