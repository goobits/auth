export declare function hashPassword(password: string): Promise<string>;
export declare function verifyPassword(storedHash: string, password: string): Promise<boolean>;
export declare function validatePasswordStrength(password: string): {
    valid: boolean;
    errors: string[];
};
