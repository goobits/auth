import type { VerificationToken } from '../../types/index.ts'
import { generateRandomUUID } from '../../utils/crypto.ts'
import {
	VerificationTokenAdapter,
	type VerificationTokenRecord
} from '../verification-token/VerificationTokenAdapter.ts'
import { type PgPoolLike, requireRow } from './query.ts'
import { type UserRow, toUser } from './user.ts'

type VerificationTokenRow = {
	created_at: Date
	expires_at: Date
	id: string
	metadata: Record<string, unknown> | null
	token: string
	type: string
	user_id: string
}

/** PostgreSQL verification-token adapter with atomic single-use consumption. */
export class PgVerificationTokenAdapter extends VerificationTokenAdapter {
	#db: PgPoolLike

	constructor({ db }: { db: PgPoolLike }) {
		super()
		this.#db = db
	}

	async create({
		userId,
		type,
		token,
		expiresAt,
		metadata
	}: {
		userId: string
		type: string
		token: string
		expiresAt: Date
		metadata?: Record<string, unknown>
	}): Promise<void> {
		await this.#db.query(
			`INSERT INTO auth_verification_tokens (id, user_id, type, token, expires_at, metadata)
			 VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
			[await generateRandomUUID(), userId, type, token, expiresAt, JSON.stringify(metadata ?? {})]
		)
	}

	async replaceForUserAndType({
		userId,
		type,
		token,
		expiresAt,
		metadata
	}: {
		userId: string
		type: string
		token: string
		expiresAt: Date
		metadata?: Record<string, unknown>
	}): Promise<void> {
		await this.#db.query(
			`INSERT INTO auth_verification_tokens (id, user_id, type, token, expires_at, metadata)
			 VALUES ($1, $2, $3, $4, $5, $6::jsonb)
			 ON CONFLICT (user_id, type) DO UPDATE SET
				id = EXCLUDED.id,
				token = EXCLUDED.token,
				expires_at = EXCLUDED.expires_at,
				metadata = EXCLUDED.metadata,
				created_at = now()`,
			[await generateRandomUUID(), userId, type, token, expiresAt, JSON.stringify(metadata ?? {})]
		)
	}

	async findByToken({
		token,
		type
	}: {
		token: string
		type: string
	}): Promise<VerificationTokenRecord | null> {
		const row = (
			await this.#db.query<VerificationTokenRow>(
				'SELECT * FROM auth_verification_tokens WHERE token = $1 AND type = $2 LIMIT 1',
				[token, type]
			)
		).rows[0]
		return row ? this.withUser(row) : null
	}

	async deleteById(tokenId: string): Promise<void> {
		await this.#db.query('DELETE FROM auth_verification_tokens WHERE id = $1', [tokenId])
	}

	async deleteByUserAndType({ userId, type }: { userId: string; type: string }): Promise<void> {
		await this.#db.query('DELETE FROM auth_verification_tokens WHERE user_id = $1 AND type = $2', [
			userId,
			type
		])
	}

	async consumeByToken({
		token,
		type
	}: {
		token: string
		type: string
	}): Promise<VerificationTokenRecord | null> {
		const row = (
			await this.#db.query<VerificationTokenRow>(
				'DELETE FROM auth_verification_tokens WHERE token = $1 AND type = $2 RETURNING *',
				[token, type]
			)
		).rows[0]
		return row ? this.withUser(row) : null
	}

	private async withUser(row: VerificationTokenRow): Promise<VerificationTokenRecord | null> {
		const userRow = (
			await this.#db.query<UserRow>('SELECT * FROM auth_users WHERE id = $1', [row.user_id])
		).rows[0]
		if (!userRow) return null
		return { token: toVerificationToken(row), user: toUser(userRow) }
	}
}

function toVerificationToken(row: VerificationTokenRow): VerificationToken {
	return {
		createdAt: row.created_at,
		expiresAt: row.expires_at,
		id: row.id,
		metadata: row.metadata ?? {},
		token: row.token,
		type: row.type,
		userId: row.user_id
	}
}
