declare function bytesToHex(bytes: Uint8Array): string;
declare function hexToBytes(hex: string): Uint8Array;
declare function timingSafeEqual(a: string, b: string): boolean;
export declare function createAdminApiKey({ prefix, bytes, }?: {
    prefix?: string;
    bytes?: number;
}): Promise<string>;
export declare function hashAdminApiKey(apiKey: string, { salt }?: {
    salt?: string;
}): Promise<string>;
export declare function verifyAdminApiKey(apiKey: string, hashed: string, { salt }?: {
    salt?: string;
}): Promise<boolean>;
export declare function parseApiKeyHeader(value: string | null): string | null;
export { timingSafeEqual, hexToBytes, bytesToHex };
