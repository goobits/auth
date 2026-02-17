import type { Cookies } from "@sveltejs/kit";
type CsrfStoreRecord = {
    value: boolean;
    expiresAt: number | null;
};
type CookiesLike = Pick<Cookies, "set" | "get" | "delete">;
export type CsrfStore = {
    get: (key: string) => Promise<CsrfStoreRecord | null>;
    set: (key: string, value: boolean, ttlMs?: number) => Promise<void>;
    delete: (key: string) => Promise<void>;
};
export declare const CSRF_COOKIE_NAME = "csrf-token";
export declare const CSRF_HEADER_NAME = "x-csrf-token";
export declare class MemoryCsrfStore {
    private _data;
    constructor();
    get(key: string): Promise<CsrfStoreRecord | null>;
    set(key: string, value: boolean, ttlMs?: number): Promise<void>;
    delete(key: string): Promise<void>;
}
export declare function createCsrfToken(): Promise<string>;
export declare function issueCsrfToken({ cookies, store, ttlMs, cookieName, secure, sameSite, path, }?: {
    cookies?: CookiesLike;
    store?: CsrfStore;
    ttlMs?: number;
    cookieName?: string;
    secure?: boolean;
    sameSite?: "lax" | "strict" | "none";
    path?: string;
}): Promise<string>;
export declare function validateCsrfRequest({ request, cookies, store, headerName, cookieName, checkExpiry, }?: {
    request?: Request;
    cookies?: CookiesLike;
    store?: CsrfStore;
    headerName?: string;
    cookieName?: string;
    checkExpiry?: boolean;
}): Promise<boolean>;
export {};
