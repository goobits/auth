type VerificationTokenRecord<TUser = Record<string, unknown>> = {
	token: { id: string; token: string; type: string; expiresAt: Date };
	user: TUser;
};

/**
 * Base Verification Token Adapter Interface
 * Implement this to use verification tokens with your database
 */
export class VerificationTokenAdapter {
	/**
	 * Create a new verification token
	 */
	async create({
		userId,
		type,
		token,
		expiresAt,
	}: {
		userId: string;
		type: string;
		token: string;
		expiresAt: Date;
	}): Promise<void> {
		throw new Error("create must be implemented");
	}

	/**
	 * Find a token by value and type
	 */
	async findByToken({
		token,
		type,
	}: {
		token: string;
		type: string;
	}): Promise<VerificationTokenRecord | null> {
		throw new Error("findByToken must be implemented");
	}

	/**
	 * Delete a token by ID
	 */
	async deleteById(tokenId: string): Promise<void> {
		throw new Error("deleteById must be implemented");
	}

	/**
	 * Delete all tokens of a specific type for a user
	 */
	async deleteByUserAndType({
		userId,
		type,
	}: {
		userId: string;
		type: string;
	}): Promise<void> {
		throw new Error("deleteByUserAndType must be implemented");
	}
}
