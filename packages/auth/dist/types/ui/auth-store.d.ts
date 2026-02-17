type AuthUser = Record<string, unknown> | null;
type AuthSession = Record<string, unknown> | null;
type AuthState = {
    user: AuthUser;
    session: AuthSession;
    isAuthenticated: boolean;
    loading: boolean;
    error: string | null;
};
type AuthEndpoints = {
    login: string;
    register: string;
    logout: string;
    session: string;
    updateProfile: string;
};
type AuthStoreOptions = {
    baseUrl?: string;
    endpoints?: Partial<AuthEndpoints>;
    publishableApiKey?: string | null;
    fetcher?: typeof fetch;
    autoCheck?: boolean;
};
export declare function createAuthStore(options?: AuthStoreOptions): {
    subscribe: (this: void, run: import("svelte/store").Subscriber<AuthState>, invalidate?: () => void) => import("svelte/store").Unsubscriber;
    login(email: string, password: string): Promise<{
        success: boolean;
        user: AuthUser;
    } | {
        success: boolean;
        error: string;
    } | {
        success: boolean;
        mfaRequired: boolean;
    }>;
    register(data: Record<string, unknown> | string): Promise<{
        success: boolean;
        user: AuthUser;
    } | {
        success: boolean;
        error: string;
    }>;
    logout(): Promise<{
        success: boolean;
    }>;
    checkSession(): Promise<void>;
    updateProfile(data: Record<string, unknown>): Promise<{
        success: boolean;
        error: string;
        user?: never;
    } | {
        success: boolean;
        user: unknown;
        error?: never;
    }>;
    refreshSession(): Promise<void>;
};
export declare const auth: {
    subscribe: (this: void, run: import("svelte/store").Subscriber<AuthState>, invalidate?: () => void) => import("svelte/store").Unsubscriber;
    login(email: string, password: string): Promise<{
        success: boolean;
        user: AuthUser;
    } | {
        success: boolean;
        error: string;
    } | {
        success: boolean;
        mfaRequired: boolean;
    }>;
    register(data: Record<string, unknown> | string): Promise<{
        success: boolean;
        user: AuthUser;
    } | {
        success: boolean;
        error: string;
    }>;
    logout(): Promise<{
        success: boolean;
    }>;
    checkSession(): Promise<void>;
    updateProfile(data: Record<string, unknown>): Promise<{
        success: boolean;
        error: string;
        user?: never;
    } | {
        success: boolean;
        user: unknown;
        error?: never;
    }>;
    refreshSession(): Promise<void>;
};
export declare const isAuthenticated: import("svelte/store").Readable<boolean>;
export declare const user: import("svelte/store").Readable<AuthUser>;
export {};
