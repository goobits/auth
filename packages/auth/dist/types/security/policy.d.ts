import { type AuthEventEmitter } from "./events.js";
import type { RequestEventLike } from "../types/auth.js";
import type { CsrfStore } from "./csrf.js";
import type { RequestHandler } from "@sveltejs/kit";
type PolicyMode = "required" | "optional" | "off";
export type SecurityRouteId = "oauth.login" | "oauth.callback" | "auth.logout" | "magic.request" | "magic.verify" | "webauthn.register.options" | "webauthn.register.verify" | "webauthn.login.options" | "webauthn.login.verify" | "sessions.list" | "sessions.revoke";
export type SecurityRoutePolicy = {
    csrf?: PolicyMode;
    rateLimit?: PolicyMode;
    audit?: PolicyMode;
};
export type SecurityPolicySettings = {
    csrf: {
        mode: PolicyMode;
        cookieName: string;
        headerName: string;
        checkExpiry: boolean;
        store?: CsrfStore;
    };
    rateLimit: {
        mode: PolicyMode;
        max: number;
        windowMs: number;
        keyPrefix: string;
        trustProxyHeader: boolean;
    };
    audit: {
        mode: PolicyMode;
        emitter?: AuthEventEmitter;
    };
    routes: Partial<Record<SecurityRouteId, SecurityRoutePolicy>>;
};
type ApplyPolicyInput = {
    handler: RequestHandler;
    routeId: SecurityRouteId;
    settings: SecurityPolicySettings;
};
export declare function applySecurityPolicy({ handler, routeId, settings, }: ApplyPolicyInput): (event: RequestEventLike) => Promise<Response>;
export {};
