// @ts-nocheck
/**
 * Base WebAuthn Adapter Interface
 */
export class WebAuthnAdapter {
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
	async createChallenge({
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
	}): Promise<void> {
		throw new Error("createChallenge must be implemented");
	}

	/**
	 * Get challenge by ID
	 * @param {string} challengeId
	 * @returns {Promise<Object|null>}
	 */
	async getChallenge(
		challengeId: string,
	): Promise<Record<string, unknown> | null> {
		throw new Error("getChallenge must be implemented");
	}

	/**
	 * Delete challenge by ID
	 * @param {string} challengeId
	 * @returns {Promise<void>}
	 */
	async deleteChallenge(challengeId: string): Promise<void> {
		throw new Error("deleteChallenge must be implemented");
	}

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
	async createCredential({
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
	}): Promise<void> {
		throw new Error("createCredential must be implemented");
	}

	/**
	 * Get a credential by ID
	 * @param {string} credentialId
	 * @returns {Promise<Object|null>}
	 */
	async getCredential(
		credentialId: string,
	): Promise<Record<string, unknown> | null> {
		throw new Error("getCredential must be implemented");
	}

	/**
	 * List credentials for a user
	 * @param {string} userId
	 * @returns {Promise<Object[]>}
	 */
	async listCredentials(userId: string): Promise<Record<string, unknown>[]> {
		throw new Error("listCredentials must be implemented");
	}

	/**
	 * Update a credential (e.g., counter)
	 * @param {string} credentialId
	 * @param {Object} updates
	 * @returns {Promise<void>}
	 */
	async updateCredential(
		credentialId: string,
		updates: Record<string, unknown>,
	): Promise<void> {
		throw new Error("updateCredential must be implemented");
	}

	/**
	 * Delete a credential
	 * @param {string} credentialId
	 * @returns {Promise<void>}
	 */
	async deleteCredential(credentialId: string): Promise<void> {
		throw new Error("deleteCredential must be implemented");
	}

	/**
	 * Delete all credentials for a user
	 * @param {string} userId
	 * @returns {Promise<void>}
	 */
	async deleteUserCredentials(userId: string): Promise<void> {
		throw new Error("deleteUserCredentials must be implemented");
	}
}
