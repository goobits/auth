import type { AuthLocals, RequestEventLike } from "../types/auth.js";
import { type AuthEventEmitter } from "./events.js";
type AuthorizerContext = {
    event: RequestEventLike;
    emitter?: AuthEventEmitter;
};
export declare function requireAuthenticated(locals: AuthLocals): asserts locals is AuthLocals & {
    user: NonNullable<AuthLocals["user"]>;
};
export declare function requireRole(context: AuthorizerContext, requiredRoles: string[]): Promise<void>;
export declare function requireOwnership(context: AuthorizerContext, resourceOwnerId: string | number): Promise<void>;
export {};
