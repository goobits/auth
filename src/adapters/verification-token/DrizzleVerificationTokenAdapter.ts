import { and, eq } from 'drizzle-orm'

import type { User, VerificationToken } from '../../types/index.ts'
import { toDrizzleUser as toUser } from '../_drizzleUser.ts'
import {
	type DrizzleDbLike,
	type InsertConflictQuery,
	type DrizzleJson,
	type DrizzleRow,
	type DrizzleTable,
	requireColumn,
	requireCondition
} from '../drizzleTypes.ts'
import {
	VerificationTokenAdapter,
	type VerificationTokenRecord
} from './VerificationTokenAdapter.ts'

type TokensTable = DrizzleTable & {
	id: DrizzleTable[string]
	userId: DrizzleTable[string]
	type: DrizzleTable[string]
	token: DrizzleTable[string]
	expiresAt: DrizzleTable[string]
	metadata: DrizzleTable[string]
}

type UsersTable = DrizzleTable & {
	id: DrizzleTable[string]
}

function isDrizzleJson(value: unknown): value is DrizzleJson {
	if (
		value === null ||
		typeof value === 'string' ||
		typeof value === 'number' ||
		typeof value === 'boolean' ||
		value instanceof Date
	) {
		return true
	}
	if (Array.isArray(value)) return value.every(isDrizzleJson)
	if (typeof value !== 'object') return false
	return Object.values(value).every(isDrizzleJson)
}

function isDrizzleJsonRecord(value: unknown): value is Record<string, DrizzleJson> {
	return (
		value !== null &&
		typeof value === 'object' &&
		!Array.isArray(value) &&
		!(value instanceof Date) &&
		Object.values(value).every(isDrizzleJson)
	)
}

function toMetadata(value: Record<string, unknown> | undefined): Record<string, DrizzleJson> {
	const candidate: unknown = value ?? {}
	if (!isDrizzleJsonRecord(candidate)) {
		throw new TypeError('Verification token metadata must be JSON-serializable')
	}
	return candidate
}

function supportsAtomicUpsert(value: unknown): value is InsertConflictQuery {
	return (
		value !== null &&
		typeof value === 'object' &&
		'onConflictDoUpdate' in value &&
		typeof value.onConflictDoUpdate === 'function'
	)
}

function toToken(row: DrizzleRow | null): VerificationToken | null {
	if (!row) return null
	const id = row['id']
	const userId = row['userId'] ?? row['user_id']
	const type = row['type']
	const token = row['token']
	const expiresAt = row['expiresAt'] ?? row['expires_at']
	const createdAt = row['createdAt'] ?? row['created_at']
	const metadata = row['metadata']
	if (typeof id !== 'string' && typeof id !== 'number') return null
	if (typeof userId !== 'string' && typeof userId !== 'number') return null
	if (typeof type !== 'string') return null
	if (typeof token !== 'string') return null
	if (!(expiresAt instanceof Date) && typeof expiresAt !== 'string') return null
	const expiresDate = expiresAt instanceof Date ? expiresAt : new Date(expiresAt)
	if (Number.isNaN(expiresDate.getTime())) return null
	const createdDate =
		createdAt instanceof Date
			? createdAt
			: typeof createdAt === 'string'
				? new Date(createdAt)
				: new Date()
	return {
		id: String(id),
		userId: String(userId),
		type,
		token,
		expiresAt: expiresDate,
		createdAt: Number.isNaN(createdDate.getTime()) ? new Date() : createdDate,
		...(isDrizzleJsonRecord(metadata) ? { metadata } : {})
	}
}

/** Drizzle verification token adapter for sessions, users, tokens, MFA, magic links, or WebAuthn records. */
export class DrizzleVerificationTokenAdapter extends VerificationTokenAdapter {
	private db: DrizzleDbLike
	private tokensTable: TokensTable
	private usersTable: UsersTable

	constructor(
		db: DrizzleDbLike,
		options: { tokensTable?: TokensTable; usersTable?: UsersTable } = {}
	) {
		super()
		if (!db) {
			throw new Error('DrizzleVerificationTokenAdapter requires a database instance')
		}
		if (!options.tokensTable) {
			throw new Error('DrizzleVerificationTokenAdapter requires tokensTable option')
		}
		if (!options.usersTable) {
			throw new Error('DrizzleVerificationTokenAdapter requires usersTable option')
		}
		this.db = db
		this.tokensTable = options.tokensTable
		this.usersTable = options.usersTable
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
		await this.db.insert(this.tokensTable).values({
			userId,
			type,
			token,
			expiresAt,
			metadata: toMetadata(metadata)
		})
	}

	override async replaceForUserAndType({
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
		const insert = this.db.insert(this.tokensTable).values({
			userId,
			type,
			token,
			expiresAt,
			metadata: toMetadata(metadata)
		})
		if (!supportsAtomicUpsert(insert)) {
			throw new TypeError('Drizzle verification-token replacement requires atomic upsert support')
		}
		await insert.onConflictDoUpdate({
			target: [this.tokensTable.userId, this.tokensTable.type],
			set: {
				token,
				expiresAt,
				metadata: toMetadata(metadata)
			}
		})
	}

	async findByToken({
		token,
		type
	}: {
		token: string
		type: string
	}): Promise<VerificationTokenRecord<User> | null> {
		const [record] = await this.db
			.select({
				token: this.tokensTable,
				user: this.usersTable
			})
			.from(this.tokensTable)
			.innerJoin(
				this.usersTable,
				eq(requireColumn(this.tokensTable, 'userId'), requireColumn(this.usersTable, 'id'))
			)
			.where(
				requireCondition(and(eq(this.tokensTable.token, token), eq(this.tokensTable.type, type)))
			)
		if (!record) return null
		const tokenRecord = toToken(record['token'] ?? null)
		const user = toUser(record['user'] ?? null)
		if (!tokenRecord || !user) return null
		return { token: tokenRecord, user }
	}

	async deleteById(tokenId: string): Promise<void> {
		await this.db.delete(this.tokensTable).where(eq(requireColumn(this.tokensTable, 'id'), tokenId))
	}

	async deleteByUserAndType({ userId, type }: { userId: string; type: string }): Promise<void> {
		await this.db
			.delete(this.tokensTable)
			.where(
				requireCondition(and(eq(this.tokensTable.userId, userId), eq(this.tokensTable.type, type)))
			)
	}

	override async consumeByToken({
		token,
		type
	}: {
		token: string
		type: string
	}): Promise<VerificationTokenRecord<User> | null> {
		// Atomic delete-returning closes the TOCTOU race: only one caller
		// gets the row back, even under concurrent verifies.
		const rows = await this.db
			.delete(this.tokensTable)
			.where(
				requireCondition(and(eq(this.tokensTable.token, token), eq(this.tokensTable.type, type)))
			)
			.returning()
		const tokenRecord = toToken(rows[0] ?? null)
		if (!tokenRecord) return null

		// User lookup is a separate read — concurrent calls would only
		// reach this point for the winner of the delete.
		const [userRow] = await this.db
			.select()
			.from(this.usersTable)
			.where(eq(requireColumn(this.usersTable, 'id'), tokenRecord.userId))
		const user = toUser(userRow ?? null)
		if (!user) return null
		return { token: tokenRecord, user }
	}
}
