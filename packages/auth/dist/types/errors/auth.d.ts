export declare class AuthPrincipalResolutionError extends Error {
    readonly code = "AUTH_PRINCIPAL_RESOLUTION_FAILED";
    readonly status: number;
    constructor(message?: string, status?: number);
}
export declare class AuthAdapterCapabilityError extends Error {
    readonly code = "AUTH_ADAPTER_CAPABILITY_UNSUPPORTED";
    readonly status: number;
    constructor(message?: string, status?: number);
}
