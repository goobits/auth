export declare function generateMagicLinkToken(bytesLength?: number): Promise<string>;
export declare function generateOtp(digits?: number): Promise<string>;
export declare function hashToken(token: string): Promise<string>;
