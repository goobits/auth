import { VerificationTokenAdapter } from '../adapters/verification-token/VerificationTokenAdapter.js'
import { generateRandomUUID, sha256Hex } from './crypto.js'

const DEFAULT_TOKEN_EXPIRATION_MS = 24 * 60 * 60 * 1000 // 24 hours

/** Verification Token Types registry entry for runtime integration. */
export const VERIFICATION_TOKEN_TYPES = {
	EMAIL_VERIFICATION: 'email_verification',
	PASSWORD_RESET: 'password_reset',
	EMAIL_UPDATE: 'email_update'
}

type VerificationTokenType =
	(typeof VERIFICATION_TOKEN_TYPES)[keyof typeof VERIFICATION_TOKEN_TYPES] | string

/**
 * Create a new single-use verification token for a user.
 * Existing tokens of the same type for the user are removed to prevent collisions.
 *
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
	expiresInMs = DEFAULT_TOKEN_EXPIRATION_MS
}: {
	adapter: VerificationTokenAdapter;
	userId: string;
	type: VerificationTokenType;
	expiresInMs?: number;
}): Promise<string> {
	const tokenValue = await generateRandomUUID()
	const tokenHash = await sha256Hex(tokenValue)
	const expiresAt = new Date(Date.now() + expiresInMs)

	// Remove existing tokens of the same type
	await adapter.deleteByUserAndType({ userId, type })

	// Create new token
	await adapter.create({
		userId,
		type,
		token: tokenHash,
		expiresAt
	})

	return tokenValue
}

/**
 * Validate and consume a token. Returns the user when valid.
 * Token is automatically deleted after consumption.
 *
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
	sanitizeUser = (user: Record<string, unknown>) => user
}: {
	adapter: VerificationTokenAdapter;
	token: string;
	type: VerificationTokenType;
	sanitizeUser?: (user: Record<string, unknown>) => unknown;
}): Promise<unknown | null> {
	const tokenHash = await sha256Hex(token)

	// Atomic consume — in-tree adapters override `consumeByToken` with a
	// single `DELETE ... RETURNING` so two concurrent verifies of the same
	// token cannot both succeed.
	const record = await adapter.consumeByToken({ token: tokenHash, type })

	if (!record) {
		return null
	}

	// Check expiration after consumption: the token is already gone, we just
	// surface the expiry outcome to the caller.
	if (record.token.expiresAt.getTime() < Date.now()) {
		return null
	}

	return sanitizeUser(record.user)
}

/**
 * Peek at a token without consuming it.
 * Useful for sending reminders or pre-validation.
 *
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
	sanitizeUser = (user: Record<string, unknown>) => user
}: {
	adapter: VerificationTokenAdapter;
	token: string;
	type: VerificationTokenType;
	sanitizeUser?: (user: Record<string, unknown>) => unknown;
}): Promise<unknown | null> {
	const tokenHash = await sha256Hex(token)
	const record = await adapter.findByToken({ token: tokenHash, type })

	if (!record) {
		return null
	}

	// Check expiration
	if (record.token.expiresAt.getTime() < Date.now()) {
		return null
	}

	return sanitizeUser(record.user)
}
