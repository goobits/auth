export declare function generateBackupCodes({ count, length, }?: {
    count?: number;
    length?: number;
}): string[];
export declare function hashBackupCodes(codes: string[]): Promise<string[]>;
export declare function verifyBackupCode({ code, hashedCodes, }: {
    code?: string;
    hashedCodes?: string[];
}): Promise<{
    valid: boolean;
    hash?: string;
    index?: number;
}>;
