/**
 * Sanitizes user object by removing sensitive fields
 * @param {Object|null} user - User object from database
 * @returns {Object|null} Sanitized user object safe for client exposure
 */
export function sanitizeUser(user) {
	if (!user) return null;

	// Remove sensitive fields that should never reach the client
	const { password, token, ...safeUser } = user;

	return safeUser;
}
