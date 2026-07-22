import type { MagicLinkToken } from '../../types/index.ts'
import { generateRandomUUID } from '../../utils/crypto.ts'
import { MagicLinkAdapter } from '../magic-link/MagicLinkAdapter.ts'
import { normalizeEmail } from '../_inputValues.ts'
import { type PgPoolLike, requireRow } from './query.ts'

type MagicLinkTokenRow = {
	created_at: Date
	email: string
	expires_at: Date
	id: string
	metadata: Record<string, unknown> | null
	otp_hash: string | null
	token_hash: string
	user_id: string | null
}

/** Postgres magic link adapter for sessions, users, tokens, MFA, magic links, or WebAuthn records. */
export class PgMagicLinkAdapter extends MagicLinkAdapter {
	#db: PgPoolLike

	constructor({ db }: { db: PgPoolLike }) {
		super()
		this.#db = db
	}

	async createToken({
		userId,
		email,
		tokenHash,
		otpHash,
		expiresAt,
		metadata
	}: {
		userId: string | null
		email: string
		tokenHash: string
		otpHash?: string | null
		expiresAt: Date
		metadata?: Record<string, unknown>
	}): Promise<MagicLinkToken> {
		const row = (
			await this.#db.query<MagicLinkTokenRow>(
				`
			INSERT INTO auth_magic_link_tokens
				(id, user_id, email, token_hash, otp_hash, expires_at, metadata)
			VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
			RETURNING *
		`,
				[
					await generateRandomUUID(),
					userId,
					normalizeEmail(email),
					tokenHash,
					otpHash ?? null,
					expiresAt,
					JSON.stringify(metadata ?? {})
				]
			)
		).rows[0]
		return toMagicLinkToken(requireRow(row))
	}

	async findByTokenHash(tokenHash: string): Promise<MagicLinkToken | null> {
		const row = (
			await this.#db.query<MagicLinkTokenRow>(
				'SELECT * FROM auth_magic_link_tokens WHERE token_hash = $1 LIMIT 1',
				[tokenHash]
			)
		).rows[0]
		return row ? toMagicLinkToken(row) : null
	}

	async findByEmailAndOtpHash({
		email,
		otpHash
	}: {
		email: string
		otpHash: string
	}): Promise<MagicLinkToken | null> {
		const row = (
			await this.#db.query<MagicLinkTokenRow>(
				'SELECT * FROM auth_magic_link_tokens WHERE email = $1 AND otp_hash = $2 LIMIT 1',
				[normalizeEmail(email), otpHash]
			)
		).rows[0]
		return row ? toMagicLinkToken(row) : null
	}

	async deleteById(tokenId: string): Promise<void> {
		await this.#db.query('DELETE FROM auth_magic_link_tokens WHERE id = $1', [tokenId])
	}

	async deleteByUserId(userId: string): Promise<void> {
		await this.#db.query('DELETE FROM auth_magic_link_tokens WHERE user_id = $1', [userId])
	}

	async deleteByEmail(email: string): Promise<void> {
		await this.#db.query('DELETE FROM auth_magic_link_tokens WHERE email = $1', [
			normalizeEmail(email)
		])
	}

	override async consumeByTokenHash(tokenHash: string): Promise<MagicLinkToken | null> {
		const row = (
			await this.#db.query<MagicLinkTokenRow>(
				'DELETE FROM auth_magic_link_tokens WHERE token_hash = $1 RETURNING *',
				[tokenHash]
			)
		).rows[0]
		return row ? toMagicLinkToken(row) : null
	}

	override async consumeByEmailAndOtpHash({
		email,
		otpHash
	}: {
		email: string
		otpHash: string
	}): Promise<MagicLinkToken | null> {
		const row = (
			await this.#db.query<MagicLinkTokenRow>(
				'DELETE FROM auth_magic_link_tokens WHERE email = $1 AND otp_hash = $2 RETURNING *',
				[normalizeEmail(email), otpHash]
			)
		).rows[0]
		return row ? toMagicLinkToken(row) : null
	}
}

function toMagicLinkToken(row: MagicLinkTokenRow): MagicLinkToken {
	return {
		createdAt: row.created_at,
		email: row.email,
		expiresAt: row.expires_at,
		id: row.id,
		otpHash: row.otp_hash,
		tokenHash: row.token_hash,
		userId: row.user_id
	}
}
