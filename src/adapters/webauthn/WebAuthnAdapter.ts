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
	 * @returns Whether the credential was inserted without replacing an existing owner.
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
	}): Promise<boolean>

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

	/** Atomically advances a credential counter for its immutable owner. */
	abstract advanceCredentialCounter(input: {
		credentialId: string
		userId: string
		expectedCounter: number
		newCounter: number
	}): Promise<boolean>

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
	 * site used during verification. Implementations must perform one atomic
	 * consume operation so concurrent verification cannot replay a challenge.
	 *
	 * @param challengeId - Identifier to use.
	 */
	abstract consumeChallenge(challengeId: string): Promise<Record<string, unknown> | null>
}
