import type { RequestEvent } from "@sveltejs/kit";
type AuditLogger = {
    info: (message: string, payload?: unknown) => void;
};
type AuditOptions = {
    logger?: AuditLogger;
    redactKeys?: string[];
};
type AuditWrapperOptions = {
    action?: string;
    includeRequestBody?: boolean;
    includeResponse?: boolean;
    logger?: AuditLogger;
    redactKeys?: string[];
};
export type AuthAuditEvent = "auth.success" | "auth.failure" | "magic_link.invalid" | "magic_link.expired" | "webauthn.challenge_missing" | "webauthn.challenge_invalid_type" | "webauthn.credential_missing" | "webauthn.authentication_failed" | "session.revoked";
export declare function auditLog(event: unknown, options?: AuditOptions): void;
export declare function withAuditLogging({ action, includeRequestBody, includeResponse, logger, redactKeys, }?: AuditWrapperOptions): (handler: (event: RequestEvent) => Promise<Response>) => (event: RequestEvent) => Promise<Response>;
export declare function auditAuthEvent(event: AuthAuditEvent, payload?: Record<string, unknown>, options?: AuditOptions): void;
export {};
