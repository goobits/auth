export type VerificationTokenRecord<TUser = Record<string, unknown>> = {
	token: {
		id: string;
		token: string;
		type: string;
		expiresAt: Date;
		metadata?: Record<string, unknown>;
	};
	user: TUser;
}

/**
 * Base Verification Token Adapter Interface
 * Implement this to use verification tokens with your database
 */
export abstract class VerificationTokenAdapter {
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
		userId: string;
		type: string;
		token: string;
		expiresAt: Date;
		metadata?: Record<string, unknown>;
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
		token: string;
		type: string;
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
	abstract deleteByUserAndType({
		userId,
		type
	}: {
		userId: string;
		type: string;
	}): Promise<void>

	/**
	 * Atomically find-and-consume a token. Should be the only call site
	 * used during verification. The default below is a non-atomic
	 * find+delete pair; adapters whose storage supports it (SQL `DELETE
	 * ... RETURNING`, in-memory `Map`) should override.
	 *
	 * @param params - params value.
	 */
	async consumeByToken(params: {
		token: string;
		type: string;
	}): Promise<VerificationTokenRecord | null> {
		const record = await this.findByToken(params)
		if (!record) return null
		await this.deleteById(record.token.id)
		return record
	}
}
