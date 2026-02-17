/**
 * Hash a password using Argon2id (native Node module)
 */
export declare function hashPassword(password: string): Promise<string>;
/**
 * Verify a password against its hash
 */
export declare function verifyPassword(storedHash: string, password: string): Promise<boolean>;
/**
 * Validate password strength (basic policy; apps may enforce stricter rules).
 */
export declare function validatePasswordStrength(password: string): {
    valid: boolean;
    errors: string[];
};
