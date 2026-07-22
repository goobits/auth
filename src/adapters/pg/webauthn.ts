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
import type { PgPoolLike } from './query.ts'

type WebAuthnChallengeRow = {
	challenge: string
	expires_at: Date
	id: string
	type: string
	user_id: string | null
}

type WebAuthnCredentialRow = {
	counter: number
	created_at: Date
	credential_id: string
	name: string | null
	public_key: string
	transports: string[] | null
	updated_at: Date
	user_id: string
}

/** Postgres web authn adapter for sessions, users, tokens, MFA, magic links, or WebAuthn records. */
export class PgWebAuthnAdapter extends WebAuthnAdapter {
	#db: PgPoolLike

	constructor({ db }: { db: PgPoolLike }) {
		super()
		this.#db = db
	}

	async createChallenge({
		challengeId,
		userId,
		challenge,
		type,
		expiresAt
	}: CreateWebAuthnChallengeInput): Promise<void> {
		await this.#db.query(
			`
			INSERT INTO auth_webauthn_challenges (id, user_id, challenge, type, expires_at)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (id) DO UPDATE SET
				user_id = EXCLUDED.user_id,
				challenge = EXCLUDED.challenge,
				type = EXCLUDED.type,
				expires_at = EXCLUDED.expires_at
		`,
			[challengeId, userId ?? null, challenge, type, expiresAt]
		)
	}

	async getChallenge(challengeId: string): Promise<Record<string, unknown> | null> {
		const row = (
			await this.#db.query<WebAuthnChallengeRow>(
				'SELECT * FROM auth_webauthn_challenges WHERE id = $1',
				[challengeId]
			)
		).rows[0]
		return row ? toWebAuthnChallenge(row) : null
	}

	async deleteChallenge(challengeId: string): Promise<void> {
		await this.#db.query('DELETE FROM auth_webauthn_challenges WHERE id = $1', [challengeId])
	}

	async consumeChallenge(challengeId: string): Promise<Record<string, unknown> | null> {
		const row = (
			await this.#db.query<WebAuthnChallengeRow>(
				'DELETE FROM auth_webauthn_challenges WHERE id = $1 RETURNING *',
				[challengeId]
			)
		).rows[0]
		return row ? toWebAuthnChallenge(row) : null
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
		const result = await this.#db.query<{ credential_id: string }>(
			`
			INSERT INTO auth_webauthn_credentials
				(user_id, credential_id, public_key, counter, transports, name)
			VALUES ($1, $2, $3, $4, $5::jsonb, $6)
			ON CONFLICT (credential_id) DO NOTHING
			RETURNING credential_id
		`,
			[userId, credentialId, publicKey, counter, JSON.stringify(transports ?? null), name ?? null]
		)
		return result.rows.length === 1
	}

	async getCredential(credentialId: string): Promise<WebAuthnCredential | null> {
		const row = (
			await this.#db.query<WebAuthnCredentialRow>(
				'SELECT * FROM auth_webauthn_credentials WHERE credential_id = $1',
				[credentialId]
			)
		).rows[0]
		return row ? toWebAuthnCredential(row) : null
	}

	async listCredentials(userId: string): Promise<WebAuthnCredential[]> {
		const rows = (
			await this.#db.query<WebAuthnCredentialRow>(
				'SELECT * FROM auth_webauthn_credentials WHERE user_id = $1 ORDER BY created_at DESC',
				[userId]
			)
		).rows
		return rows.map(toWebAuthnCredential)
	}

	async advanceCredentialCounter({
		credentialId,
		userId,
		expectedCounter,
		newCounter
	}: AdvanceWebAuthnCredentialCounterInput): Promise<boolean> {
		assertCredentialCounterTransition(expectedCounter, newCounter)
		const result = await this.#db.query<{ credential_id: string }>(
			`UPDATE auth_webauthn_credentials
			 SET counter = $1, updated_at = now()
			 WHERE credential_id = $2 AND user_id = $3 AND counter = $4
			 RETURNING credential_id`,
			[newCounter, credentialId, userId, expectedCounter]
		)
		return result.rows.length === 1
	}

	async deleteCredential(credentialId: string): Promise<void> {
		await this.#db.query('DELETE FROM auth_webauthn_credentials WHERE credential_id = $1', [
			credentialId
		])
	}

	async deleteUserCredentials(userId: string): Promise<void> {
		await this.#db.query('DELETE FROM auth_webauthn_credentials WHERE user_id = $1', [userId])
	}
}

function toWebAuthnChallenge(row: WebAuthnChallengeRow): Record<string, unknown> {
	return {
		challenge: row.challenge,
		expiresAt: row.expires_at,
		id: row.id,
		type: row.type,
		userId: row.user_id
	}
}

function toWebAuthnCredential(row: WebAuthnCredentialRow): WebAuthnCredential {
	return {
		counter: row.counter,
		createdAt: row.created_at,
		credentialId: row.credential_id,
		id: row.credential_id,
		name: row.name,
		publicKey: row.public_key,
		transports: Array.isArray(row.transports) ? row.transports : null,
		updatedAt: row.updated_at,
		userId: row.user_id
	}
}
