import { type Handle, type RequestHandler } from "@sveltejs/kit";
import type { AuthConfig, RequestEventLike } from "./types/auth.js";
import type { Session, User } from "./types/index.js";
type AuthPrincipal = {
    session: Session;
    user: User;
};
type AuthHandlersBundle = {
    GET: RequestHandler;
    POST: RequestHandler;
};
type RoleResolver = (user: User) => string[];
export type GoobitsAuthRoutingConfig = {
    basePath?: string;
    signInPath?: string;
    signOutPath?: string;
};
export type GoobitsAuthConfig = Omit<AuthConfig, "adapters"> & ({
    adapter: AuthConfig["adapters"];
    adapters?: AuthConfig["adapters"];
} | {
    adapter?: never;
    adapters: AuthConfig["adapters"];
}) & {
    routing?: GoobitsAuthRoutingConfig;
};
export declare class GoobitsAuth {
    private readonly core;
    private readonly routing;
    private readonly defaultHandlers;
    constructor(config: GoobitsAuthConfig);
    get adapter(): AuthConfig["adapters"];
    get providers(): Record<string, import("./types/auth.js").OAuthProviderConfig>;
    get handlers(): AuthHandlersBundle;
    handle(): Handle;
    createHandlers(options?: {
        basePath?: string;
    }): AuthHandlersBundle;
    getSession(event: RequestEventLike): Promise<AuthPrincipal | null>;
    requireUser(event: RequestEventLike): Promise<User>;
    requireRole(event: RequestEventLike, role: string | string[], options?: {
        resolveRoles?: RoleResolver;
    }): Promise<User>;
    private resolveTarget;
}
export type Auth = GoobitsAuth;
export {};
