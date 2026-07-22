import type { WebAuthnCredential } from '../../types/index.ts'
import {
	WebAuthnAdapter,
	type AdvanceWebAuthnCredentialCounterInput,
	type CreateWebAuthnChallengeInput,
	type CreateWebAuthnCredentialInput
} from '../webauthn/WebAuthnAdapter.ts'
import {
	assertCredentialCounterTransition,
	isValidCredentialCounter
} from '../webauthn/_credentialCounter.ts'

/** In-memory WebAuthn adapter for challenges and credentials. */
export class MemoryWebAuthnAdapter extends WebAuthnAdapter {
	#challenges = new Map<string, Record<string, unknown>>()
	#credentials = new Map<string, WebAuthnCredential>()

	async createChallenge({
		challengeId,
		userId,
		challenge,
		type,
		expiresAt
	}: CreateWebAuthnChallengeInput): Promise<void> {
		this.#challenges.set(challengeId, {
			challenge,
			expiresAt,
			id: challengeId,
			type,
			userId: userId ?? null
		})
	}

	async getChallenge(challengeId: string): Promise<Record<string, unknown> | null> {
		return this.#challenges.get(challengeId) ?? null
	}

	async deleteChallenge(challengeId: string): Promise<void> {
		this.#challenges.delete(challengeId)
	}

	async consumeChallenge(challengeId: string): Promise<Record<string, unknown> | null> {
		const challenge = this.#challenges.get(challengeId) ?? null
		if (challenge) this.#challenges.delete(challengeId)
		return challenge
	}

	async createCredential({
		userId,
		credentialId,
		publicKey,
		counter,
		transports,
		name
	}: CreateWebAuthnCredentialInput): Promise<boolean> {
		if (!isValidCredentialCounter(counter)) {
			throw new RangeError('WebAuthn counter must be a non-negative safe integer')
		}
		if (this.#credentials.has(credentialId)) return false
		const now = new Date()
		this.#credentials.set(credentialId, {
			counter,
			createdAt: now,
			credentialId,
			id: credentialId,
			name: name ?? null,
			publicKey,
			transports: transports ?? null,
			updatedAt: now,
			userId
		})
		return true
	}

	async getCredential(credentialId: string): Promise<WebAuthnCredential | null> {
		return this.#credentials.get(credentialId) ?? null
	}

	async listCredentials(userId: string): Promise<WebAuthnCredential[]> {
		return [...this.#credentials.values()].filter((credential) => credential.userId === userId)
	}

	async advanceCredentialCounter({
		credentialId,
		userId,
		expectedCounter,
		newCounter
	}: AdvanceWebAuthnCredentialCounterInput): Promise<boolean> {
		assertCredentialCounterTransition(expectedCounter, newCounter)
		const existing = this.#credentials.get(credentialId)
		if (!existing || existing.userId !== userId || existing.counter !== expectedCounter)
			return false
		this.#credentials.set(credentialId, {
			...existing,
			counter: newCounter,
			updatedAt: new Date()
		})
		return true
	}

	async deleteCredential(credentialId: string): Promise<void> {
		this.#credentials.delete(credentialId)
	}

	async deleteUserCredentials(userId: string): Promise<void> {
		for (const [credentialId, credential] of this.#credentials.entries()) {
			if (credential.userId === userId) {
				this.#credentials.delete(credentialId)
			}
		}
	}
}
