import {
	VerificationTokenAdapter,
	type VerificationTokenRecord
} from '../adapters/verification-token/VerificationTokenAdapter.ts'
import { VERIFICATION_TOKEN_TYPES } from '../types/core.ts'
import { generateRandomUUID, sha256Hex } from './crypto.ts'

const DEFAULT_TOKEN_EXPIRATION_MS = 24 * 60 * 60 * 1000 // 24 hours

export { VERIFICATION_TOKEN_TYPES } from '../types/core.ts'

type VerificationTokenType =
	| (typeof VERIFICATION_TOKEN_TYPES)[keyof typeof VERIFICATION_TOKEN_TYPES]
	| string

/** Hashes an opaque verification token for adapter storage or lookup. */
export const hashVerificationToken = (token: string): Promise<string> => sha256Hex(token)

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
	expiresInMs = DEFAULT_TOKEN_EXPIRATION_MS,
	metadata
}: {
	adapter: VerificationTokenAdapter
	userId: string
	type: VerificationTokenType
	expiresInMs?: number
	metadata?: Record<string, unknown>
}): Promise<string> {
	const tokenValue = await generateRandomUUID()
	const tokenHash = await hashVerificationToken(tokenValue)
	const expiresAt = new Date(Date.now() + expiresInMs)

	// Remove existing tokens of the same type
	await adapter.deleteByUserAndType({ userId, type })

	// Create new token
	const createInput: {
		userId: string
		type: string
		token: string
		expiresAt: Date
		metadata?: Record<string, unknown>
	} = {
		userId,
		type,
		token: tokenHash,
		expiresAt
	}
	if (metadata) createInput.metadata = metadata
	await adapter.create(createInput)

	return tokenValue
}

/** Returns a valid verification-token record without consuming it. */
export async function getVerificationTokenRecord({
	adapter,
	token,
	type
}: {
	adapter: VerificationTokenAdapter
	token: string
	type: VerificationTokenType
}): Promise<VerificationTokenRecord | null> {
	const tokenHash = await hashVerificationToken(token)
	const record = await adapter.findByToken({ token: tokenHash, type })
	if (!record || record.token.expiresAt.getTime() < Date.now()) return null
	return record
}

/** Atomically consumes a valid verification-token record. */
export async function consumeVerificationTokenRecord({
	adapter,
	token,
	type
}: {
	adapter: VerificationTokenAdapter
	token: string
	type: VerificationTokenType
}): Promise<VerificationTokenRecord | null> {
	const tokenHash = await hashVerificationToken(token)
	const record = await adapter.consumeByToken({ token: tokenHash, type })
	if (!record || record.token.expiresAt.getTime() < Date.now()) return null
	return record
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
	adapter: VerificationTokenAdapter
	token: string
	type: VerificationTokenType
	sanitizeUser?: (user: Record<string, unknown>) => unknown
}): Promise<unknown | null> {
	const record = await consumeVerificationTokenRecord({ adapter, token, type })
	if (!record) return null

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
	adapter: VerificationTokenAdapter
	token: string
	type: VerificationTokenType
	sanitizeUser?: (user: Record<string, unknown>) => unknown
}): Promise<unknown | null> {
	const record = await getVerificationTokenRecord({ adapter, token, type })
	if (!record) return null

	return sanitizeUser(record.user)
}
