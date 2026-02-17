import type { AuthConfig, AuthHandlers, AuthLocals, AuthRoutes, OAuthProviderConfig, SecurityProfile } from "./types/auth.js";
import type { User } from "./types/index.js";
import { type SecurityPolicySettings } from "./security/policy.js";
type ResolvedDefaults = {
    urlConfig: {
        login: string;
        afterLogin: string;
        afterLogout: string;
    };
    cookieConfig: {
        secure: boolean;
    };
    autoCreateSession: boolean;
    requireVerifiedEmailForLinking: boolean;
    isAuthenticated: (locals: AuthLocals) => boolean;
};
type ResolvedSecurity = SecurityPolicySettings & {
    profile: SecurityProfile;
};
export type AuthInstance = {
    adapters: AuthConfig["adapters"];
    providers: Record<string, OAuthProviderConfig>;
    urls: ResolvedDefaults["urlConfig"];
    cookies: ResolvedDefaults["cookieConfig"];
    profile: SecurityProfile;
    security: ResolvedSecurity;
    hooks: AuthConfig["hooks"];
    handlers: AuthHandlers;
    routes: AuthRoutes;
    utils: ReturnType<typeof createUtils>;
};
declare function createUtils(isAuthenticated: (locals: AuthLocals) => boolean): {
    isAuthenticated: (locals: AuthLocals) => boolean;
    getUser: (locals: AuthLocals) => User | null | undefined;
    getSession: (locals: AuthLocals) => import("./types/index.js").Session | null | undefined;
};
export declare function createAuth(config: AuthConfig): AuthInstance;
export {};
