import { omitSensitiveUserData } from '../adapters/database/publicUserData.ts'

/**
 * Sanitizes user object by removing sensitive fields
 * @param {Object|null} user - User object from database
 * @returns {Object|null} Sanitized user object safe for client exposure
 */
export function sanitizeUser(user: Record<string, unknown> | null): Record<string, unknown> | null {
	if (!user) return null

	return omitSensitiveUserData(user)
}
