export declare class MemoryRateLimitStore {
    private _data;
    constructor();
    get(key: string): Promise<{
        count: number;
        resetAt: number;
    } | null>;
    set(key: string, value: {
        count: number;
        resetAt: number;
    }): Promise<void>;
    delete(key: string): Promise<void>;
}
type KVNamespaceLike = {
    get: (key: string, options?: {
        type: "json";
    }) => Promise<unknown>;
    put: (key: string, value: string, options?: {
        expirationTtl: number;
    }) => Promise<void>;
    delete: (key: string) => Promise<void>;
};
export declare class KVRateLimitStore {
    private namespace;
    private ttlSeconds;
    constructor(namespace: KVNamespaceLike, options?: {
        ttlSeconds?: number | null;
    });
    get(key: string): Promise<{
        count: number;
        resetAt: number;
    } | null>;
    set(key: string, value: {
        count: number;
        resetAt: number;
    }, ttlMs?: number): Promise<void>;
    delete(key: string): Promise<void>;
}
type RateLimiterConfig = {
    store?: MemoryRateLimitStore | KVRateLimitStore;
    windowMs?: number;
    max?: number;
    keyPrefix?: string;
};
type RateLimitResult = {
    allowed: boolean;
    remaining: number;
    resetAt: number;
};
export declare function createRateLimiter({ store, windowMs, max, keyPrefix, }?: RateLimiterConfig): (key: string) => Promise<RateLimitResult>;
export {};
