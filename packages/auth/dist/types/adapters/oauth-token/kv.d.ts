import { TokenAdapter } from "./base.js";
type KVNamespaceLike = {
    put: (key: string, value: string) => Promise<void>;
    get: (key: string) => Promise<string | null>;
    delete: (key: string) => Promise<void>;
};
export declare class KVTokenAdapter extends TokenAdapter {
    private namespace;
    private encrypt;
    private encryptionKey;
    private keyPrefix;
    constructor(namespace: KVNamespaceLike, options?: {
        encrypt?: boolean;
        encryptionKey?: string | null;
        keyPrefix?: string;
    });
    _key(userId: string, provider: string): string;
    storeTokens(userId: string, provider: string, tokens: Record<string, unknown>): Promise<void>;
    getTokens(userId: string, provider: string): Promise<any>;
    refreshTokens(userId: string, provider: string): Promise<import("../../types/index.js").OAuthTokens | null>;
    deleteTokens(userId: string, provider: string): Promise<void>;
}
export {};
