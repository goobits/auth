/**
 * Base WebAuthn Adapter Interface
 */
export abstract class WebAuthnAdapter {
	/**
	 * Store a WebAuthn challenge
	 *
	 * @param {string} params.challengeId - Identifier to use.
	 * @param {string|null} [params.userId] - Identifier to use.
	 * @param {string} params.challenge - challenge value.
	 * @param {string} params.type - 'registration' | 'authentication'
	 * @param {Date} params.expiresAt - expires at value.
	 * @returns {Promise<void>}
	 */
	abstract createChallenge({
		challengeId,
		userId,
		challenge,
		type,
		expiresAt
	}: {
		challengeId: string
		userId?: string | null
		challenge: string
		type: string
		expiresAt: Date
	}): Promise<void>

	/**
	 * Get challenge by ID
	 *
	 * @param {string} challengeId - Identifier to use.
	 * @returns {Promise<Object|null>}
	 */
	abstract getChallenge(challengeId: string): Promise<Record<string, unknown> | null>

	/**
	 * Delete challenge by ID
	 *
	 * @param {string} challengeId - Identifier to use.
	 * @returns {Promise<void>}
	 */
	abstract deleteChallenge(challengeId: string): Promise<void>

	/**
	 * Create a credential
	 *
	 * @param {string} params.userId - Identifier to use.
	 * @param {string} params.credentialId - Identifier to use.
	 * @param {string} params.publicKey - public key value.
	 * @param {number} params.counter - counter value.
	 * @param {string[]|null} [params.transports] - transports value.
	 * @param {string|null} [params.name] - Name to use.
	 * @returns {Promise<void>}
	 */
	abstract createCredential({
		userId,
		credentialId,
		publicKey,
		counter,
		transports,
		name
	}: {
		userId: string
		credentialId: string
		publicKey: string
		counter: number
		transports?: string[] | null
		name?: string | null
	}): Promise<void>

	/**
	 * Get a credential by ID
	 *
	 * @param {string} credentialId - Identifier to use.
	 * @returns {Promise<Object|null>}
	 */
	abstract getCredential(credentialId: string): Promise<Record<string, unknown> | null>

	/**
	 * List credentials for a user
	 *
	 * @param {string} userId - Identifier to use.
	 * @returns {Promise<Object[]>}
	 */
	abstract listCredentials(userId: string): Promise<Record<string, unknown>[]>

	/**
	 * Update a credential (e.g., counter)
	 *
	 * @param {string} credentialId - Identifier to use.
	 * @param {Object} updates - Updates to apply.
	 * @returns {Promise<void>}
	 */
	abstract updateCredential(credentialId: string, updates: Record<string, unknown>): Promise<void>

	/**
	 * Delete a credential
	 *
	 * @param {string} credentialId - Identifier to use.
	 * @returns {Promise<void>}
	 */
	abstract deleteCredential(credentialId: string): Promise<void>

	/**
	 * Delete all credentials for a user
	 *
	 * @param {string} userId - Identifier to use.
	 * @returns {Promise<void>}
	 */
	abstract deleteUserCredentials(userId: string): Promise<void>

	/**
	 * Atomically find-and-consume a challenge. Should be the only call
	 * site used during verification. The default below is a non-atomic
	 * get+delete pair; adapters whose storage supports it should override
	 * with a single `DELETE ... RETURNING` so two concurrent verifies of
	 * the same challenge cannot both succeed.
	 *
	 * @param challengeId - Identifier to use.
	 */
	async consumeChallenge(challengeId: string): Promise<Record<string, unknown> | null> {
		const record = await this.getChallenge(challengeId)
		if (record) {
			await this.deleteChallenge(challengeId)
		}
		return record
	}
}
