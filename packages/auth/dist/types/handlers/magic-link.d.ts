import type { RequestHandler } from "@sveltejs/kit";
import type { AuthLocals, AuthHooks, RequestEventLike } from "../types/auth.js";
import type { User } from "../types/index.js";
import type { Session } from "../types/index.js";
import { type OnLoginMode } from "../utils/session-lifecycle.js";
type MagicLinkAdapterLike = {
    createToken: (params: {
        userId: string | null;
        email: string;
        tokenHash: string;
        otpHash?: string | null;
        expiresAt: Date;
        metadata?: Record<string, unknown>;
    }) => Promise<Record<string, unknown> | void>;
    findByTokenHash: (hash: string) => Promise<Record<string, unknown> | null>;
    findByEmailAndOtpHash: (params: {
        email: string;
        otpHash: string;
    }) => Promise<Record<string, unknown> | null>;
    deleteById: (id: string) => Promise<unknown>;
    deleteByEmail: (email: string) => Promise<unknown>;
};
type MagicLinkUserAdapterLike = {
    getUserByEmail: (email: string) => Promise<User | null>;
    getUserById: (id: string) => Promise<User | null>;
    createUser: (profile: {
        id: string;
        email: string;
        name: string;
        verified_email?: boolean;
    }) => Promise<User>;
    updateUser: (id: string, data: Record<string, unknown>) => Promise<User>;
};
type MagicLinkSessionAdapterLike = {
    createSession: (userId: string) => Promise<Session>;
    setSessionCookie?: (cookies: RequestEventLike["cookies"], session: Session) => void;
};
type MagicLinkRequestConfig = {
    magicLinkAdapter: MagicLinkAdapterLike;
    databaseAdapter?: Pick<MagicLinkUserAdapterLike, "getUserByEmail">;
    sendEmail: (payload: {
        email: string;
        link: string;
        otp: string | null;
        token: string;
        expiresAt: Date;
        user: User | null;
        redirectTo: string;
        secureCookies: boolean;
    }) => Promise<void> | void;
    allowSignup?: boolean;
    expiresInMs?: number;
    magicLinkPath?: string;
    includeOtp?: boolean;
    otpDigits?: number;
    singleUsePerEmail?: boolean;
    secureCookies?: boolean;
    normalizeEmail?: (email: string) => string;
    exposeToken?: boolean;
    baseUrl?: string;
    rateLimit?: (event: RequestEventLike) => Promise<void> | void;
    getMetadata?: (event: RequestEventLike) => Promise<Record<string, unknown>>;
    trustProxyHeader?: boolean;
    key?: (event: RequestEventLike) => string;
};
type MagicLinkVerifyConfig = {
    magicLinkAdapter: MagicLinkAdapterLike;
    databaseAdapter?: MagicLinkUserAdapterLike;
    sessionAdapter: MagicLinkSessionAdapterLike;
    allowSignup?: boolean;
    createUser?: (email: string, event: RequestEventLike) => Promise<User>;
    onLogin?: AuthHooks["onLogin"];
    redirectAfterLogin?: string;
    isAuthenticated?: (locals: AuthLocals) => boolean;
    secureCookies?: boolean;
    normalizeEmail?: (email: string) => string;
    verifyRateLimit?: (key: string) => Promise<{
        allowed: boolean;
    }>;
    verifyRateLimitMax?: number;
    verifyRateLimitWindowMs?: number;
    sanitizeUser?: (user: User | null) => User | null;
    autoCreateSession?: boolean;
    onLoginMode?: OnLoginMode;
    trustProxyHeader?: boolean;
    key?: (event: RequestEventLike) => string;
};
export declare function createMagicLinkRequestHandler(config: MagicLinkRequestConfig): RequestHandler;
export declare function createMagicLinkVerifyHandler(config: MagicLinkVerifyConfig): (event: RequestEventLike) => Promise<Response>;
export {};
