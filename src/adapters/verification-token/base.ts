type VerificationTokenRecord<TUser = Record<string, unknown>> = {
	token: { id: string; token: string; type: string; expiresAt: Date };
	user: TUser;
};

/**
 * Base Verification Token Adapter Interface
 * Implement this to use verification tokens with your database
 */
export abstract class VerificationTokenAdapter {
	/**
	 * Create a new verification token
	 */
	abstract create({
		userId,
		type,
		token,
		expiresAt,
	}: {
		userId: string;
		type: string;
		token: string;
		expiresAt: Date;
	}): Promise<void>;

	/**
	 * Find a token by value and type
	 */
	abstract findByToken({
		token,
		type,
	}: {
		token: string;
		type: string;
	}): Promise<VerificationTokenRecord | null>;

	/**
	 * Delete a token by ID
	 */
	abstract deleteById(tokenId: string): Promise<void>;

	/**
	 * Delete all tokens of a specific type for a user
	 */
	abstract deleteByUserAndType({
		userId,
		type,
	}: {
		userId: string;
		type: string;
	}): Promise<void>;
}
