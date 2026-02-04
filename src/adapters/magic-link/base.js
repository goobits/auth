/**
 * Base Magic Link Adapter Interface
 * Stores one-time magic link tokens and OTPs.
 */
export class MagicLinkAdapter {
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
	async createToken({ userId, email, tokenHash, otpHash, expiresAt, metadata }) {
		throw new Error("createToken must be implemented");
	}

	/**
	 * Find a token by hashed token
	 * @param {string} tokenHash
	 * @returns {Promise<Object|null>}
	 */
	async findByTokenHash(tokenHash) {
		throw new Error("findByTokenHash must be implemented");
	}

	/**
	 * Find a token by email + OTP hash
	 * @param {Object} params
	 * @param {string} params.email
	 * @param {string} params.otpHash
	 * @returns {Promise<Object|null>}
	 */
	async findByEmailAndOtpHash({ email, otpHash }) {
		throw new Error("findByEmailAndOtpHash must be implemented");
	}

	/**
	 * Delete a token record by ID
	 * @param {string} tokenId
	 * @returns {Promise<void>}
	 */
	async deleteById(tokenId) {
		throw new Error("deleteById must be implemented");
	}

	/**
	 * Delete tokens for a user
	 * @param {string} userId
	 * @returns {Promise<void>}
	 */
	async deleteByUserId(userId) {
		throw new Error("deleteByUserId must be implemented");
	}

	/**
	 * Delete tokens for an email
	 * @param {string} email
	 * @returns {Promise<void>}
	 */
	async deleteByEmail(email) {
		throw new Error("deleteByEmail must be implemented");
	}
}
