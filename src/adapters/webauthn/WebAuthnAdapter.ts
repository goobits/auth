export type CreateWebAuthnChallengeInput = {
	challengeId: string
	userId?: string | null
	challenge: string
	type: string
	expiresAt: Date
}

export type WebAuthnChallengeRecord = {
	id: string
	userId: string | null
	challenge: string
	type: string
	expiresAt: Date
}

export type CreateWebAuthnCredentialInput = {
	userId: string
	credentialId: string
	publicKey: string
	counter: number
	transports?: string[] | null
	name?: string | null
}

export const DEFAULT_WEBAUTHN_CREDENTIAL_LIMIT = 10

export function resolveWebAuthnCredentialLimit(value: number | undefined): number {
	const limit = value ?? DEFAULT_WEBAUTHN_CREDENTIAL_LIMIT
	if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
		throw new RangeError('WebAuthn credential limit must be an integer between 1 and 100')
	}
	return limit
}

export type CreateWebAuthnCredentialWithinLimitInput = CreateWebAuthnCredentialInput & {
	maxCredentialsPerUser: number
}

export type WebAuthnCredentialCreationOutcome =
	| 'created'
	| 'duplicate'
	| 'limit-reached'
	| 'owner-unavailable'

export type AdvanceWebAuthnCredentialCounterInput = {
	credentialId: string
	userId: string
	expectedCounter: number
	newCounter: number
}

export type DeleteWebAuthnCredentialInput = {
	credentialId: string
	userId: string
}

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
	}: CreateWebAuthnChallengeInput): Promise<void>

	/**
	 * Get challenge by ID
	 *
	 * @param {string} challengeId - Identifier to use.
	 * @returns {Promise<Object|null>}
	 */
	abstract getChallenge(challengeId: string): Promise<WebAuthnChallengeRecord | null>

	/**
	 * Delete challenge by ID
	 *
	 * @param {string} challengeId - Identifier to use.
	 * @returns Whether the credential was inserted without replacing an existing owner.
	 */
	abstract deleteChallenge(challengeId: string): Promise<void>

	/** Delete expired challenges and return the number removed. */
	abstract deleteExpiredChallenges(expiresAtOrBefore: Date): Promise<number>

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
	}: CreateWebAuthnCredentialInput): Promise<boolean>

	/**
	 * Creates one credential while enforcing the owner cap at the persistence boundary.
	 * Stateful adapters should override this method with their native transaction or lock.
	 */
	async createCredentialWithinLimit({
		maxCredentialsPerUser,
		...credential
	}: CreateWebAuthnCredentialWithinLimitInput): Promise<WebAuthnCredentialCreationOutcome> {
		const limit = resolveWebAuthnCredentialLimit(maxCredentialsPerUser)
		if ((await this.listCredentials(credential.userId)).length >= limit) return 'limit-reached'
		return (await this.createCredential(credential)) ? 'created' : 'duplicate'
	}

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
	abstract advanceCredentialCounter(input: AdvanceWebAuthnCredentialCounterInput): Promise<boolean>

	/**
	 * Delete a credential
	 *
	 * @param input - Immutable credential owner and identifier.
	 * @returns Whether an owned credential was removed.
	 */
	abstract deleteCredential(input: DeleteWebAuthnCredentialInput): Promise<boolean>

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
	abstract consumeChallenge(challengeId: string): Promise<WebAuthnChallengeRecord | null>
}
