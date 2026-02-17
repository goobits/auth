/**
 * Create a password reset request handler
 * @param {Object} config - Handler configuration
 * @param {import('../adapters/database/base.js').UserAdapter} config.userAdapter - User adapter
 * @param {import('../adapters/verification-token/base.js').VerificationTokenAdapter} config.verificationTokenAdapter - Verification token adapter
 * @param {Function} config.sendPasswordResetEmail - Function to send reset email (email, token) => Promise<void>
 * @param {Object} [config.csrf] - CSRF validation config
 * @param {Function} [config.csrf.validate] - Async function (event) => boolean
 * @param {string} [config.csrf.errorMessage] - Error message for invalid CSRF
 * @param {Object} [config.rateLimit] - Rate limit config
 * @param {Function} [config.rateLimit.check] - Async function (key) => { allowed }
 * @param {Function} [config.rateLimit.key] - Function (event) => string for rate limit key
 * @returns {Function} SvelteKit request handler
 */
import type { RequestEventLike } from "../types/auth.js";
import type { User } from "../types/index.js";
import type { VerificationTokenAdapter } from "../adapters/verification-token/base.js";
type RateLimitConfig = {
    check?: (key: string) => Promise<{
        allowed: boolean;
    }>;
    key?: (event: RequestEventLike) => string;
    trustProxyHeader?: boolean;
};
export declare function createPasswordResetRequestHandler(config: {
    userAdapter: {
        getUserByEmail: (email: string) => Promise<User | null>;
    };
    verificationTokenAdapter: VerificationTokenAdapter;
    sendPasswordResetEmail: (email: string, token: string) => Promise<void> | void;
    csrf?: {
        validate?: (event: RequestEventLike) => Promise<boolean>;
        errorMessage?: string;
    };
    rateLimit?: RateLimitConfig;
}): (event: RequestEventLike) => Promise<{
    error: string;
    success: boolean;
    message?: never;
} | {
    success: boolean;
    message: string;
    error?: never;
}>;
/**
 * Create a password reset confirmation handler
 * @param {Object} config - Handler configuration
 * @param {import('../providers/credentials.js').CredentialsProvider} config.credentialsProvider - Credentials provider
 * @param {import('../adapters/database/base.js').UserAdapter} config.userAdapter - User adapter
 * @param {import('../adapters/verification-token/base.js').VerificationTokenAdapter} config.verificationTokenAdapter - Verification token adapter
 * @param {import('../adapters/session/base.js').SessionAdapter} [config.sessionAdapter] - Session adapter (optional)
 * @param {string} [config.redirectTo] - Redirect URL after reset (default: '/sign-in')
 * @returns {Function} SvelteKit request handler
 */
export declare function createPasswordResetConfirmHandler(config: {
    credentialsProvider: {
        updatePassword: (input: {
            userId: string;
            newPassword: string;
            userAdapter: unknown;
        }) => Promise<void>;
    };
    userAdapter: unknown;
    verificationTokenAdapter: VerificationTokenAdapter;
    sessionAdapter?: {
        invalidateUserSessions?: (userId: string) => Promise<void>;
    };
    redirectTo?: string;
}): (event: RequestEventLike) => Promise<{
    error: string;
    success: boolean;
    message?: never;
    redirectTo?: never;
} | {
    success: boolean;
    message: string;
    redirectTo: string;
    error?: never;
}>;
export {};
