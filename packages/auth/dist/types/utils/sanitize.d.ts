/**
 * Sanitizes user object by removing sensitive fields
 * @param {Object|null} user - User object from database
 * @returns {Object|null} Sanitized user object safe for client exposure
 */
export declare function sanitizeUser(user: Record<string, unknown> | null): Record<string, unknown> | null;
