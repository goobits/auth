import type { MfaStatus } from '../../types/index.ts'
import { MfaAdapter, type MfaSecretCodec } from '../mfa/MfaAdapter.ts'
import type { PgPoolLike } from './query.ts'

type MfaFactorRow = {
	enabled_at: Date | null
	secret: string
	user_id: string
}

type MfaStatusRow = {
	backup_code_count: string | number
	enabled_at: Date | null
}

/** Postgres mfa adapter for sessions, users, tokens, MFA, magic links, or WebAuthn records. */
export class PgMfaAdapter extends MfaAdapter {
	#db: PgPoolLike
	#secretCodec: MfaSecretCodec

	constructor({ db, secretCodec }: { db: PgPoolLike; secretCodec: MfaSecretCodec }) {
		super()
		if (typeof secretCodec?.encrypt !== 'function' || typeof secretCodec?.decrypt !== 'function') {
			throw new Error('PgMfaAdapter requires an MFA secret encryption codec')
		}
		this.#db = db
		this.#secretCodec = secretCodec
	}

	async beginEnrollment(userId: string, secret: string, backupCodes: string[]): Promise<boolean> {
		if (backupCodes.length === 0) return false
		const ciphertext = await this.#secretCodec.encrypt(secret, userId)
		if (typeof ciphertext !== 'string' || !ciphertext.trim() || ciphertext === secret) {
			throw new Error('PgMfaAdapter secret codec returned unencrypted plaintext')
		}
		const rows = (
			await this.#db.query<{ user_id: string }>(
				`
			WITH factor AS (
				INSERT INTO auth_mfa_factors (user_id, secret, enabled_at, last_used_counter)
				VALUES ($1, $2, NULL, NULL)
				ON CONFLICT (user_id) DO UPDATE SET
					secret = EXCLUDED.secret,
					enabled_at = NULL,
					last_used_counter = NULL,
					updated_at = now()
				WHERE auth_mfa_factors.enabled_at IS NULL
				RETURNING user_id
			), removed AS (
				DELETE FROM auth_mfa_backup_codes
				WHERE user_id IN (SELECT user_id FROM factor)
				RETURNING user_id
			)
			INSERT INTO auth_mfa_backup_codes (user_id, code_hash)
			SELECT factor.user_id, code_hash
			FROM factor
			CROSS JOIN UNNEST($3::text[]) AS code_hash
			CROSS JOIN (SELECT COUNT(*) FROM removed) AS removal_complete
			RETURNING user_id
		`,
				[userId, ciphertext, backupCodes]
			)
		).rows
		return rows.length > 0
	}

	async getSecret(userId: string): Promise<string | null> {
		const row = (
			await this.#db.query<MfaFactorRow>(
				'SELECT user_id, secret, enabled_at FROM auth_mfa_factors WHERE user_id = $1',
				[userId]
			)
		).rows[0]
		if (!row) return null
		const secret = await this.#secretCodec.decrypt(row.secret, userId)
		if (typeof secret !== 'string' || !secret.trim()) {
			throw new Error('PgMfaAdapter secret codec returned an empty plaintext')
		}
		return secret
	}

	async activateEnrollment(userId: string, counter: number): Promise<boolean> {
		this.assertTotpCounter(counter)
		const rows = (
			await this.#db.query<{ user_id: string }>(
				`UPDATE auth_mfa_factors AS factor
				 SET enabled_at = now(), last_used_counter = $2, updated_at = now()
				 WHERE factor.user_id = $1
				   AND factor.enabled_at IS NULL
				   AND EXISTS (
				     SELECT 1 FROM auth_mfa_backup_codes AS backup
				     WHERE backup.user_id = factor.user_id
				   )
				 RETURNING factor.user_id`,
				[userId, counter]
			)
		).rows
		return rows.length === 1
	}

	async disableMfa(userId: string): Promise<boolean> {
		const rows = (
			await this.#db.query<{ user_id: string }>(
				'DELETE FROM auth_mfa_factors WHERE user_id = $1 RETURNING user_id',
				[userId]
			)
		).rows
		return rows.length === 1
	}

	async getBackupCodes(userId: string): Promise<string[]> {
		const rows = (
			await this.#db.query<{ code_hash: string }>(
				'SELECT code_hash FROM auth_mfa_backup_codes WHERE user_id = $1 ORDER BY created_at ASC',
				[userId]
			)
		).rows
		return rows.map((row) => row.code_hash)
	}

	async consumeBackupCode(userId: string, hash: string): Promise<boolean> {
		const rows = (
			await this.#db.query<{ code_hash: string }>(
				'DELETE FROM auth_mfa_backup_codes WHERE user_id = $1 AND code_hash = $2 RETURNING code_hash',
				[userId, hash]
			)
		).rows
		return rows.length === 1
	}

	async consumeTotpCounter(userId: string, counter: number): Promise<boolean> {
		this.assertTotpCounter(counter)
		const rows = (
			await this.#db.query<{ user_id: string }>(
				`UPDATE auth_mfa_factors
				 SET last_used_counter = $2, updated_at = now()
				 WHERE user_id = $1
				   AND enabled_at IS NOT NULL
				   AND (last_used_counter IS NULL OR last_used_counter < $2)
				 RETURNING user_id`,
				[userId, counter]
			)
		).rows
		return rows.length === 1
	}

	async getStatus(userId: string): Promise<MfaStatus> {
		const row = (
			await this.#db.query<MfaStatusRow>(
				`
				SELECT
					f.enabled_at,
					COUNT(c.code_hash) AS backup_code_count
				FROM auth_mfa_factors f
				LEFT JOIN auth_mfa_backup_codes c ON c.user_id = f.user_id
				WHERE f.user_id = $1
				GROUP BY f.enabled_at
			`,
				[userId]
			)
		).rows[0]
		return {
			backupCodeCount: Number(row?.backup_code_count ?? 0),
			enabled: Boolean(row?.enabled_at),
			enabledAt: row?.enabled_at ?? null
		}
	}
}
