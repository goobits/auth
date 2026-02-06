/**
 * Base WebAuthn Adapter Interface
 */
export abstract class WebAuthnAdapter {
	/**
	 * Store a WebAuthn challenge
	 * @param {Object} params
	 * @param {string} params.challengeId
	 * @param {string|null} [params.userId]
	 * @param {string} params.challenge
	 * @param {string} params.type - 'registration' | 'authentication'
	 * @param {Date} params.expiresAt
	 * @returns {Promise<void>}
	 */
	abstract createChallenge({
		challengeId,
		userId,
		challenge,
		type,
		expiresAt,
	}: {
		challengeId: string;
		userId?: string | null;
		challenge: string;
		type: string;
		expiresAt: Date;
	}): Promise<void>;

	/**
	 * Get challenge by ID
	 * @param {string} challengeId
	 * @returns {Promise<Object|null>}
	 */
	abstract getChallenge(
		challengeId: string,
	): Promise<Record<string, unknown> | null>;

	/**
	 * Delete challenge by ID
	 * @param {string} challengeId
	 * @returns {Promise<void>}
	 */
	abstract deleteChallenge(challengeId: string): Promise<void>;

	/**
	 * Create a credential
	 * @param {Object} params
	 * @param {string} params.userId
	 * @param {string} params.credentialId
	 * @param {string} params.publicKey
	 * @param {number} params.counter
	 * @param {string[]|null} [params.transports]
	 * @param {string|null} [params.name]
	 * @returns {Promise<void>}
	 */
	abstract createCredential({
		userId,
		credentialId,
		publicKey,
		counter,
		transports,
		name,
	}: {
		userId: string;
		credentialId: string;
		publicKey: string;
		counter: number;
		transports?: string[] | null;
		name?: string | null;
	}): Promise<void>;

	/**
	 * Get a credential by ID
	 * @param {string} credentialId
	 * @returns {Promise<Object|null>}
	 */
	abstract getCredential(
		credentialId: string,
	): Promise<Record<string, unknown> | null>;

	/**
	 * List credentials for a user
	 * @param {string} userId
	 * @returns {Promise<Object[]>}
	 */
	abstract listCredentials(userId: string): Promise<Record<string, unknown>[]>;

	/**
	 * Update a credential (e.g., counter)
	 * @param {string} credentialId
	 * @param {Object} updates
	 * @returns {Promise<void>}
	 */
	abstract updateCredential(
		credentialId: string,
		updates: Record<string, unknown>,
	): Promise<void>;

	/**
	 * Delete a credential
	 * @param {string} credentialId
	 * @returns {Promise<void>}
	 */
	abstract deleteCredential(credentialId: string): Promise<void>;

	/**
	 * Delete all credentials for a user
	 * @param {string} userId
	 * @returns {Promise<void>}
	 */
	abstract deleteUserCredentials(userId: string): Promise<void>;
}
