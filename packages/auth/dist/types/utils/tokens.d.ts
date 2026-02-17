import { VerificationTokenAdapter } from "../adapters/verification-token/base.js";
export declare const VERIFICATION_TOKEN_TYPES: {
    EMAIL_VERIFICATION: string;
    PASSWORD_RESET: string;
    EMAIL_UPDATE: string;
};
type VerificationTokenType = (typeof VERIFICATION_TOKEN_TYPES)[keyof typeof VERIFICATION_TOKEN_TYPES] | string;
/**
 * Create a new single-use verification token for a user.
 * Existing tokens of the same type for the user are removed to prevent collisions.
 *
 * @param {Object} params
 * @param {VerificationTokenAdapter} params.adapter - Token adapter instance
 * @param {string} params.userId - User ID
 * @param {string} params.type - Token type from VERIFICATION_TOKEN_TYPES
 * @param {number} [params.expiresInMs] - Expiration time in milliseconds
 * @returns {Promise<string>} Token value
 */
export declare function createVerificationToken({ adapter, userId, type, expiresInMs, }: {
    adapter: VerificationTokenAdapter;
    userId: string;
    type: VerificationTokenType;
    expiresInMs?: number;
}): Promise<string>;
/**
 * Validate and consume a token. Returns the user when valid.
 * Token is automatically deleted after consumption.
 *
 * @param {Object} params
 * @param {VerificationTokenAdapter} params.adapter - Token adapter instance
 * @param {string} params.token - Token value
 * @param {string} params.type - Token type from VERIFICATION_TOKEN_TYPES
 * @param {Function} [params.sanitizeUser] - Optional function to sanitize user object
 * @returns {Promise<Object | null>} User object or null if invalid/expired
 */
export declare function consumeVerificationToken({ adapter, token, type, sanitizeUser, }: {
    adapter: VerificationTokenAdapter;
    token: string;
    type: VerificationTokenType;
    sanitizeUser?: (user: Record<string, unknown>) => unknown;
}): Promise<unknown | null>;
/**
 * Peek at a token without consuming it.
 * Useful for sending reminders or pre-validation.
 *
 * @param {Object} params
 * @param {VerificationTokenAdapter} params.adapter - Token adapter instance
 * @param {string} params.token - Token value
 * @param {string} params.type - Token type from VERIFICATION_TOKEN_TYPES
 * @param {Function} [params.sanitizeUser] - Optional function to sanitize user object
 * @returns {Promise<Object | null>} User object or null if invalid/expired
 */
export declare function getUserForVerificationToken({ adapter, token, type, sanitizeUser, }: {
    adapter: VerificationTokenAdapter;
    token: string;
    type: VerificationTokenType;
    sanitizeUser?: (user: Record<string, unknown>) => unknown;
}): Promise<unknown | null>;
export {};
