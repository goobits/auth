type PasskeyEndpoints = {
    magicLinkRequest?: string;
    magicLinkVerify?: string;
    passkeyRegisterOptions?: string;
    passkeyRegisterVerify?: string;
    passkeyLoginOptions?: string;
    passkeyLoginVerify?: string;
    sessions?: string;
};
type CreateAuthClientOptions = {
    baseUrl?: string;
    endpoints?: PasskeyEndpoints;
    fetcher?: typeof fetch;
};
export declare function createAuthClient({ baseUrl, endpoints, fetcher, }?: CreateAuthClientOptions): {
    loginWithOAuth(provider: string): string;
    sendMagicLink({ email, redirectTo, }?: {
        email?: string;
        redirectTo?: string;
    }): Promise<any>;
    verifyMagicLink({ token, otp, email, }?: {
        token?: string;
        otp?: string;
        email?: string;
    }): Promise<any>;
    registerPasskey({ name }?: {
        name?: string;
    }): Promise<any>;
    loginWithPasskey({ email }?: {
        email?: string;
    }): Promise<any>;
    listSessions(): Promise<any>;
    revokeSession({ sessionId, all, others, }?: {
        sessionId?: string;
        all?: boolean;
        others?: boolean;
    }): Promise<any>;
};
export {};
