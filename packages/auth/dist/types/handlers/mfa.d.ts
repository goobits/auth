import type { RequestEventLike } from "../types/auth.js";
type MfaStore = {
    setSecret: (userId: string, secret: string) => Promise<void>;
    setBackupCodes: (userId: string, codes: string[]) => Promise<void>;
    enableMfa: (userId: string) => Promise<void>;
    getSecret: (userId: string) => Promise<string>;
    disableMfa: (userId: string) => Promise<void>;
    getBackupCodes: (userId: string) => Promise<string[]>;
    consumeBackupCode: (userId: string, hash: string) => Promise<void>;
};
type MfaConfig = {
    getUserId: (locals: RequestEventLike["locals"]) => string | null;
    store: MfaStore;
    issuer?: string;
    label?: (userId: string, locals: RequestEventLike["locals"]) => string;
};
/**
 * Create MFA enrollment handler
 * @param {Object} config
 * @param {Function} config.getUserId - function (locals) => userId
 * @param {Object} config.store - MFA store with setSecret/setBackupCodes/enableMfa
 * @param {string} config.issuer - issuer name
 * @param {Function} [config.label] - function (userId, locals) => label
 */
export declare function createMfaEnrollHandler(config: MfaConfig): (event: RequestEventLike) => Promise<{
    success: boolean;
    error: string;
    secret?: never;
    otpauthUrl?: never;
    backupCodes?: never;
} | {
    success: boolean;
    secret: string;
    otpauthUrl: string;
    backupCodes: string[];
    error?: never;
}>;
/**
 * Verify MFA token to enable MFA
 */
export declare function createMfaVerifyHandler(config: MfaConfig): (event: RequestEventLike) => Promise<{
    success: boolean;
    error: string;
} | {
    success: boolean;
    error?: never;
}>;
export declare function createMfaDisableHandler(config: MfaConfig): (event: RequestEventLike) => Promise<{
    success: boolean;
    error: string;
} | {
    success: boolean;
    error?: never;
}>;
export declare function createMfaBackupCodeHandler(config: MfaConfig): (event: RequestEventLike) => Promise<{
    success: boolean;
    error: string;
} | {
    success: boolean;
    error?: never;
}>;
export {};
