import type { RequestEventLike } from "../types/auth.js";
import type { User } from "../types/index.js";
type RateLimitConfig = {
    check?: (key: string) => Promise<{
        allowed: boolean;
    }>;
    key?: (event: RequestEventLike) => string;
    trustProxyHeader?: boolean;
};
/**
 * Create a signin handler for credentials-based authentication
 * @param {Object} config - Handler configuration
 * @param {import('../providers/credentials.js').CredentialsProvider} config.credentialsProvider - Credentials provider
 * @param {import('../adapters/database/base.js').UserAdapter} config.userAdapter - User adapter
 * @param {import('../adapters/session/base.js').SessionAdapter} config.sessionAdapter - Session adapter
 * @param {Function} [config.onSignin] - Callback after successful signin (user) => Promise<void>
 * @param {Object} [config.csrf] - CSRF validation config
 * @param {Function} [config.csrf.validate] - Async function (event) => boolean
 * @param {string} [config.csrf.errorMessage] - Error message for invalid CSRF
 * @param {Object} [config.rateLimit] - Rate limit config
 * @param {Function} [config.rateLimit.check] - Async function (key) => { allowed }
 * @param {Function} [config.rateLimit.key] - Function (event) => string for rate limit key
 * @param {string} [config.redirectTo] - Redirect URL after signin (default: '/')
 * @param {Object} [config.fields] - Form field names (identifier, email, password, remember)
 * @param {string} [config.identifierField] - Identifier field (e.g. 'nickname')
 * @param {boolean} [config.allowBoth] - Allow email + identifier fallback
 * @returns {Function} SvelteKit request handler
 */
export declare function createSigninHandler(config: {
    credentialsProvider: {
        authenticate: (input: {
            email?: string;
            identifier?: string;
            identifierField?: string;
            allowBoth?: boolean;
            password: string;
            userAdapter: unknown;
        }) => Promise<{
            user: User | null;
            valid: boolean;
        }>;
    };
    userAdapter: unknown;
    sessionAdapter: {
        createSession: (userId: string, metadata?: Record<string, unknown>) => Promise<{
            id: string;
            expiresAt: Date;
        }>;
        setSessionCookie: (cookies: RequestEventLike["cookies"], session: {
            id: string;
            expiresAt: Date;
        }) => void;
    };
    onSignin?: (user: User | null) => Promise<void> | void;
    csrf?: {
        validate?: (event: RequestEventLike) => Promise<boolean>;
        errorMessage?: string;
    };
    rateLimit?: RateLimitConfig;
    redirectTo?: string;
    sanitizeUser?: (user: User | null) => User | null;
    fields?: {
        identifier?: string;
        email?: string;
        password?: string;
        remember?: string;
    };
    identifierField?: string;
    allowBoth?: boolean;
}): (event: RequestEventLike) => Promise<{
    error: string;
    success: boolean;
    user?: never;
} | {
    success: boolean;
    user: User | null;
    error?: never;
}>;
export {};
