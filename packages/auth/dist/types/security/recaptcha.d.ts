type RecaptchaOptions = {
    secretKey?: string;
    action?: string | null;
    minScore?: number;
    timeoutMs?: number;
    allowInDevelopment?: boolean;
};
export declare function verifyRecaptchaToken(token: string | null, options?: RecaptchaOptions): Promise<boolean>;
export {};
