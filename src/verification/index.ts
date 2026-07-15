import {
	VerificationTokenAdapter,
	type VerificationTokenRecord
} from '../adapters/verification-token/VerificationTokenAdapter.ts'
import { VERIFICATION_TOKEN_TYPES } from '../types/core.ts'
import { generateRandomUUID, sha256Hex } from '../utils/crypto.ts'

const DEFAULT_TOKEN_EXPIRATION_MS = 24 * 60 * 60 * 1000

export { VERIFICATION_TOKEN_TYPES } from '../types/core.ts'

type VerificationTokenType =
	| (typeof VERIFICATION_TOKEN_TYPES)[keyof typeof VERIFICATION_TOKEN_TYPES]
	| string

/** Hashes an opaque verification token for adapter storage or lookup. */
export const hashVerificationToken = (token: string): Promise<string> => sha256Hex(token)

/** Creates a hashed, single-use verification token and returns only its raw delivery value. */
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

	await adapter.deleteByUserAndType({ userId, type })
	await adapter.create({
		userId,
		type,
		token: tokenHash,
		expiresAt,
		...(metadata ? { metadata } : {})
	})

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

/** Atomically consumes a valid token and returns its sanitized user. */
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
	return record ? sanitizeUser(record.user) : null
}

/** Reads the sanitized user associated with a valid token without consuming it. */
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
	return record ? sanitizeUser(record.user) : null
}
