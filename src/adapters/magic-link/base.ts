/**
 * Base Magic Link Adapter Interface
 * Stores one-time magic link tokens and OTPs.
 */
export abstract class MagicLinkAdapter {
	/**
	 * Create a magic link token record
	 * @param {Object} params
	 * @param {string|null} params.userId
	 * @param {string} params.email
	 * @param {string} params.tokenHash
	 * @param {string|null} [params.otpHash]
	 * @param {Date} params.expiresAt
	 * @param {Object} [params.metadata]
	 * @returns {Promise<Object>}
	 */
	abstract createToken({
		userId,
		email,
		tokenHash,
		otpHash,
		expiresAt,
		metadata,
	}: {
		userId: string | null;
		email: string;
		tokenHash: string;
		otpHash?: string | null;
		expiresAt: Date;
		metadata?: Record<string, unknown>;
	}): Promise<Record<string, unknown> | void>;

	/**
	 * Find a token by hashed token
	 * @param {string} tokenHash
	 * @returns {Promise<Object|null>}
	 */
	abstract findByTokenHash(
		tokenHash: string,
	): Promise<Record<string, unknown> | null>;

	/**
	 * Find a token by email + OTP hash
	 * @param {Object} params
	 * @param {string} params.email
	 * @param {string} params.otpHash
	 * @returns {Promise<Object|null>}
	 */
	abstract findByEmailAndOtpHash({
		email,
		otpHash,
	}: {
		email: string;
		otpHash: string;
	}): Promise<Record<string, unknown> | null>;

	/**
	 * Delete a token record by ID
	 * @param {string} tokenId
	 * @returns {Promise<void>}
	 */
	abstract deleteById(tokenId: string): Promise<void>;

	/**
	 * Delete tokens for a user
	 * @param {string} userId
	 * @returns {Promise<void>}
	 */
	abstract deleteByUserId(userId: string): Promise<void>;

	/**
	 * Delete tokens for an email
	 * @param {string} email
	 * @returns {Promise<void>}
	 */
	abstract deleteByEmail(email: string): Promise<void>;

	/**
	 * Atomically find-and-consume a token by its hash. Should be the only
	 * call sites use during verification — the default below is a
	 * non-atomic find+delete pair (susceptible to TOCTOU under concurrent
	 * verifies of the same token). Backends that can do this atomically
	 * (SQL `DELETE ... RETURNING`, in-memory `Map`) should override.
	 */
	async consumeByTokenHash(
		tokenHash: string,
	): Promise<Record<string, unknown> | null> {
		const record = await this.findByTokenHash(tokenHash);
		if (!record) return null;
		const id = (record as Record<string, unknown>)["id"];
		if (typeof id === "string") {
			await this.deleteById(id);
		}
		return record as Record<string, unknown>;
	}

	/**
	 * Atomically find-and-consume a token by email + OTP hash. Same
	 * atomicity caveat as `consumeByTokenHash`.
	 */
	async consumeByEmailAndOtpHash(params: {
		email: string;
		otpHash: string;
	}): Promise<Record<string, unknown> | null> {
		const record = await this.findByEmailAndOtpHash(params);
		if (!record) return null;
		const id = (record as Record<string, unknown>)["id"];
		if (typeof id === "string") {
			await this.deleteById(id);
		}
		return record as Record<string, unknown>;
	}
}
