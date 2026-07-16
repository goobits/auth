export type VerificationTokenRecord<TUser = Record<string, unknown>> = {
	token: {
		id: string
		token: string
		type: string
		expiresAt: Date
		metadata?: Record<string, unknown>
	}
	user: TUser
}

/**
 * Base Verification Token Adapter Interface
 * Implement this to use verification tokens with your database
 */
export abstract class VerificationTokenAdapter {
	/**
	 * Atomically replace the active token for one user and token type.
	 *
	 * Implementations must commit the replacement as one database operation or
	 * transaction. Deleting the previous token before inserting the new one can
	 * strand the user when the insert fails.
	 */
	abstract replaceForUserAndType({
		userId,
		type,
		token,
		expiresAt,
		metadata
	}: {
		userId: string
		type: string
		token: string
		expiresAt: Date
		metadata?: Record<string, unknown>
	}): Promise<void>

	/**
	 * Create a new verification token
	 *
	 * @param userId - Identifier to use.
	 * @param type - Type identifier.
	 * @param token - Token value.
	 * @param expiresAt - expires at value.
	 */
	abstract create({
		userId,
		type,
		token,
		expiresAt,
		metadata
	}: {
		userId: string
		type: string
		token: string
		expiresAt: Date
		metadata?: Record<string, unknown>
	}): Promise<void>

	/**
	 * Find a token by value and type
	 *
	 * @param token - Token value.
	 * @param type - Type identifier.
	 */
	abstract findByToken({
		token,
		type
	}: {
		token: string
		type: string
	}): Promise<VerificationTokenRecord | null>

	/**
	 * Delete a token by ID
	 *
	 * @param tokenId - Identifier to use.
	 */
	abstract deleteById(tokenId: string): Promise<void>

	/**
	 * Delete all tokens of a specific type for a user
	 *
	 * @param userId - Identifier to use.
	 * @param type - Type identifier.
	 */
	abstract deleteByUserAndType({ userId, type }: { userId: string; type: string }): Promise<void>

	/**
	 * Atomically find-and-consume a token. Verification must never fall back to
	 * a racy find-then-delete sequence.
	 *
	 * @param params - params value.
	 */
	abstract consumeByToken(params: {
		token: string
		type: string
	}): Promise<VerificationTokenRecord | null>
}
