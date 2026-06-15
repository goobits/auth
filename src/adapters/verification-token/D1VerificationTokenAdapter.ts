import type { User, VerificationToken } from '../../types/index.js'
import { VerificationTokenAdapter } from './VerificationTokenAdapter.js'

type D1Value = string | number | boolean | null
type D1Row = Record<string, D1Value>

type D1DatabaseLike = {
	prepare: (sql: string) => {
		bind: (...args: D1Value[]) => {
			run: () => Promise<void>;
			first: () => Promise<D1Row | null>;
		};
	};
}

type TokenUserRecord = {
	token: VerificationToken;
	user: User;
}

function getOwnOrFallback(row: D1Row, key: string, fallback: D1Value | undefined): D1Value | undefined {
	return Object.prototype.hasOwnProperty.call(row, key) ? row[key] : fallback
}

export class D1VerificationTokenAdapter extends VerificationTokenAdapter {
	private db: D1DatabaseLike
	private tokensTable: string
	private usersTable: string
	private columns: {
		id: string;
		userId: string;
		type: string;
		token: string;
		expiresAt: string;
	}
	private userColumns: {
		id: string;
		email: string;
		name: string;
		avatar: string;
	}

	constructor(
		db: D1DatabaseLike,
		options: {
			tokensTable?: string;
			usersTable?: string;
			columns?: Partial<Record<string, string>>;
			userColumns?: Partial<Record<string, string>>;
		} = {}
	) {
		super()
		this.db = db
		this.tokensTable = options.tokensTable || 'verification_tokens'
		this.usersTable = options.usersTable || 'users'
		this.columns = {
			id: options.columns?.['id'] || 'id',
			userId: options.columns?.['userId'] || 'user_id',
			type: options.columns?.['type'] || 'type',
			token: options.columns?.['token'] || 'token',
			expiresAt: options.columns?.['expiresAt'] || 'expires_at'
		}
		this.userColumns = {
			id: options.userColumns?.['id'] || 'id',
			email: options.userColumns?.['email'] || 'email',
			name: options.userColumns?.['name'] || 'name',
			avatar: options.userColumns?.['avatar'] || 'avatar'
		}
	}

	private coerceDbId(id: string): string | number {
		return /^\d+$/.test(id) ? Number(id) : id
	}

	private mapTokenAndUser(row: D1Row | null): TokenUserRecord | null {
		if (!row) return null
		const tokenId = row['token_id'] ?? row[this.columns.id]
		const tokenUserId = row['token_user_id'] ?? row[this.columns.userId]
		const type = row['token_type'] ?? row[this.columns.type]
		const token = row['verification_token'] ?? row[this.columns.token]
		const expiresAt = row['token_expires_at'] ?? row[this.columns.expiresAt]
		const userId = row['user_id'] ?? row[this.userColumns.id] ?? tokenUserId
		const email = row['user_email'] ?? row[this.userColumns.email]
		const name = row['user_name'] ?? row[this.userColumns.name]
		const avatar = getOwnOrFallback(row, 'user_avatar', row[this.userColumns.avatar])
		if (
			(typeof tokenId !== 'string' && typeof tokenId !== 'number') ||
			(typeof tokenUserId !== 'string' && typeof tokenUserId !== 'number') ||
			(typeof userId !== 'string' && typeof userId !== 'number') ||
			typeof type !== 'string' ||
			typeof token !== 'string' ||
			typeof expiresAt !== 'string' ||
			typeof email !== 'string' ||
			typeof name !== 'string' ||
			(avatar !== null && typeof avatar !== 'string')
		) {
			return null
		}
		const expiresAtDate = new Date(expiresAt)
		if (Number.isNaN(expiresAtDate.getTime())) return null
		const tokenRecord: VerificationToken = {
			id: String(tokenId),
			userId: String(tokenUserId),
			type,
			token,
			expiresAt: expiresAtDate,
			createdAt: new Date()
		}
		const user: User = {
			id: String(userId),
			email,
			name,
			avatar,
			emailVerified: true
		}
		return { token: tokenRecord, user }
	}

	async create({
		userId,
		type,
		token,
		expiresAt
	}: {
		userId: string;
		type: string;
		token: string;
		expiresAt: Date;
	}) {
		await this.db
			.prepare(
				`INSERT INTO ${ this.tokensTable } (${ this.columns.id }, ${ this.columns.userId }, ${ this.columns.type }, ${ this.columns.token }, ${ this.columns.expiresAt }) VALUES (?, ?, ?, ?, ?)`
			)
			.bind(
				crypto.randomUUID(),
				this.coerceDbId(userId),
				type,
				token,
				expiresAt.toISOString()
			)
			.run()
	}

	async findByToken({ token, type }: { token: string; type: string }): Promise<TokenUserRecord | null> {
		const row = await this.db
			.prepare(
				`SELECT t.${ this.columns.id } AS token_id, t.${ this.columns.userId } AS token_user_id, t.${ this.columns.type } AS token_type, t.${ this.columns.token } AS verification_token, t.${ this.columns.expiresAt } AS token_expires_at, u.${ this.userColumns.id } AS user_id, u.${ this.userColumns.email } AS user_email, u.${ this.userColumns.name } AS user_name, u.${ this.userColumns.avatar } AS user_avatar FROM ${ this.tokensTable } t JOIN ${ this.usersTable } u ON t.${ this.columns.userId } = u.${ this.userColumns.id } WHERE t.${ this.columns.token } = ? AND t.${ this.columns.type } = ? LIMIT 1`
			)
			.bind(token, type)
			.first()

		return this.mapTokenAndUser(row)
	}

	async deleteById(tokenId: string) {
		await this.db
			.prepare(`DELETE FROM ${ this.tokensTable } WHERE ${ this.columns.id } = ?`)
			.bind(tokenId)
			.run()
	}

	async deleteByUserAndType({ userId, type }: { userId: string; type: string }) {
		await this.db
			.prepare(
				`DELETE FROM ${ this.tokensTable } WHERE ${ this.columns.userId } = ? AND ${ this.columns.type } = ?`
			)
			.bind(this.coerceDbId(userId), type)
			.run()
	}

	override async consumeByToken({
		token,
		type
	}: {
		token: string;
		type: string;
	}): Promise<TokenUserRecord | null> {
		// Atomic delete-returning closes the TOCTOU race: only one caller
		// gets the row back, even under concurrent verifies. We then look
		// up the user — only the winner of the delete reaches this point.
		const deletedRow = await this.db
			.prepare(
				`DELETE FROM ${ this.tokensTable } WHERE ${ this.columns.token } = ? AND ${ this.columns.type } = ? RETURNING *`
			)
			.bind(token, type)
			.first()
		if (!deletedRow) return null
		const userId = deletedRow[this.columns.userId]
		if (typeof userId !== 'string' && typeof userId !== 'number') return null
		const userRow = await this.db
			.prepare(`SELECT * FROM ${ this.usersTable } WHERE ${ this.userColumns.id } = ? LIMIT 1`)
			.bind(this.coerceDbId(String(userId)))
			.first()

		// Reuse the token+user mapper by merging the rows.
		const merged: D1Row = {
			token_id: deletedRow[this.columns.id] ?? null,
			token_user_id: deletedRow[this.columns.userId] ?? null,
			token_type: deletedRow[this.columns.type] ?? null,
			verification_token: deletedRow[this.columns.token] ?? null,
			token_expires_at: deletedRow[this.columns.expiresAt] ?? null,
			user_id: userRow?.[this.userColumns.id] ?? userId,
			user_email: userRow?.[this.userColumns.email] ?? null,
			user_name: userRow?.[this.userColumns.name] ?? null,
			user_avatar: userRow?.[this.userColumns.avatar] ?? null
		}
		return this.mapTokenAndUser(merged)
	}
}
