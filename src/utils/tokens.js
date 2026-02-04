import { generateRandomUUID } from "./crypto.js";

const DEFAULT_TOKEN_EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export const VERIFICATION_TOKEN_TYPES = {
	EMAIL_VERIFICATION: "email_verification",
	PASSWORD_RESET: "password_reset",
	EMAIL_UPDATE: "email_update",
};

/**
 * Verification Token Adapter Interface
 * Implement this to use verification tokens with your database
 */
export class VerificationTokenAdapter {
	/**
	 * Create a new verification token
	 * @param {Object} params
	 * @param {string} params.userId - User ID
	 * @param {string} params.type - Token type
	 * @param {string} params.token - Token value
	 * @param {Date} params.expiresAt - Expiration date
	 * @returns {Promise<void>}
	 */
	async create({ userId, type, token, expiresAt }) {
		throw new Error("create must be implemented");
	}

	/**
	 * Find a token by value and type
	 * @param {Object} params
	 * @param {string} params.token - Token value
	 * @param {string} params.type - Token type
	 * @returns {Promise<{token: Object, user: Object} | null>}
	 */
	async findByToken({ token, type }) {
		throw new Error("findByToken must be implemented");
	}

	/**
	 * Delete a token by ID
	 * @param {string} tokenId - Token ID
	 * @returns {Promise<void>}
	 */
	async deleteById(tokenId) {
		throw new Error("deleteById must be implemented");
	}

	/**
	 * Delete all tokens of a specific type for a user
	 * @param {Object} params
	 * @param {string} params.userId - User ID
	 * @param {string} params.type - Token type
	 * @returns {Promise<void>}
	 */
	async deleteByUserAndType({ userId, type }) {
		throw new Error("deleteByUserAndType must be implemented");
	}
}

/**
 * Create a new single-use verification token for a user.
 * Existing tokens of the same type for the user are removed to prevent collisions.
 *
 * @param {Object} params
 * @param {VerificationTokenAdapter} params.adapter - Token adapter instance
 * @param {string} params.userId - User ID
 * @param {string} params.type - Token type from VERIFICATION_TOKEN_TYPES
 * @param {number} [params.expiresInMs] - Expiration time in milliseconds
 * @returns {Promise<string>} Token value
 */
export async function createVerificationToken({
	adapter,
	userId,
	type,
	expiresInMs = DEFAULT_TOKEN_EXPIRATION_MS,
}) {
	const tokenValue = await generateRandomUUID();
	const expiresAt = new Date(Date.now() + expiresInMs);

	// Remove existing tokens of the same type
	await adapter.deleteByUserAndType({ userId, type });

	// Create new token
	await adapter.create({
		userId,
		type,
		token: tokenValue,
		expiresAt,
	});

	return tokenValue;
}

/**
 * Validate and consume a token. Returns the user when valid.
 * Token is automatically deleted after consumption.
 *
 * @param {Object} params
 * @param {VerificationTokenAdapter} params.adapter - Token adapter instance
 * @param {string} params.token - Token value
 * @param {string} params.type - Token type from VERIFICATION_TOKEN_TYPES
 * @param {Function} [params.sanitizeUser] - Optional function to sanitize user object
 * @returns {Promise<Object | null>} User object or null if invalid/expired
 */
export async function consumeVerificationToken({
	adapter,
	token,
	type,
	sanitizeUser = (user) => user,
}) {
	const record = await adapter.findByToken({ token, type });

	if (!record) {
		return null;
	}

	// Delete token immediately (consume it)
	await adapter.deleteById(record.token.id);

	// Check expiration
	if (record.token.expiresAt.getTime() < Date.now()) {
		return null;
	}

	return sanitizeUser(record.user);
}

/**
 * Peek at a token without consuming it.
 * Useful for sending reminders or pre-validation.
 *
 * @param {Object} params
 * @param {VerificationTokenAdapter} params.adapter - Token adapter instance
 * @param {string} params.token - Token value
 * @param {string} params.type - Token type from VERIFICATION_TOKEN_TYPES
 * @param {Function} [params.sanitizeUser] - Optional function to sanitize user object
 * @returns {Promise<Object | null>} User object or null if invalid/expired
 */
export async function getUserForVerificationToken({
	adapter,
	token,
	type,
	sanitizeUser = (user) => user,
}) {
	const record = await adapter.findByToken({ token, type });

	if (!record) {
		return null;
	}

	// Check expiration
	if (record.token.expiresAt.getTime() < Date.now()) {
		return null;
	}

	return sanitizeUser(record.user);
}
