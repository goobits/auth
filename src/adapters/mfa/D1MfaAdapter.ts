import type { MfaStatus } from '../../types/core.ts'
import { assertD1Identifiers } from '../_d1Sql.ts'
import { MfaAdapter, type MfaSecretCodec } from './MfaAdapter.ts'

type D1Row = Record<string, unknown>

type D1Result<T = D1Row> = {
	results?: T[]
	success?: boolean
	meta?: { changes?: number }
}

type D1PreparedStatement = {
	bind: (...args: unknown[]) => D1PreparedStatement
	first: <T = D1Row>() => Promise<T | null>
	all: <T = D1Row>() => Promise<{ results?: T[] }>
	run: () => Promise<{ meta: { last_row_id: number; changes: number } }>
}

type D1DatabaseLike = {
	prepare: (sql: string) => D1PreparedStatement
	batch: <T = D1Row>(statements: D1PreparedStatement[]) => Promise<D1Result<T>[]>
}

type D1DatabaseInput = Omit<D1DatabaseLike, 'batch'> & {
	batch?: D1DatabaseLike['batch']
}

type D1MfaAdapterOptions = {
	secretCodec: MfaSecretCodec
	factorsTable?: string
	backupCodesTable?: string
	factorColumns?: Partial<{
		userId: string
		secret: string
		enabledAt: string
		updatedAt: string | null
	}>
	backupCodeColumns?: Partial<{
		userId: string
		hash: string
		createdAt: string
	}>
}

function parseDate(value: unknown): Date | null {
	if (typeof value !== 'string' && typeof value !== 'number') return null
	const normalized = typeof value === 'number' && value < 1e12 ? value * 1000 : value
	const parsed = new Date(normalized)
	return Number.isNaN(parsed.getTime()) ? null : parsed
}

/** Cloudflare D1 MFA adapter with atomic factor changes and encrypted TOTP secrets. */
export class D1MfaAdapter extends MfaAdapter {
	private readonly db: D1DatabaseLike
	private readonly secretCodec: MfaSecretCodec
	private readonly factorsTable: string
	private readonly backupCodesTable: string
	private readonly factorColumns: {
		userId: string
		secret: string
		enabledAt: string
		updatedAt: string | null
	}
	private readonly backupCodeColumns: {
		userId: string
		hash: string
		createdAt: string
	}

	constructor(db: D1DatabaseInput, options: D1MfaAdapterOptions) {
		super()
		if (typeof db?.batch !== 'function') {
			throw new Error('@goobits/auth: D1MfaAdapter requires transactional batch support')
		}
		if (
			typeof options?.secretCodec?.encrypt !== 'function' ||
			typeof options?.secretCodec?.decrypt !== 'function'
		) {
			throw new Error('@goobits/auth: D1MfaAdapter requires an MFA secret encryption codec')
		}
		this.db = db as D1DatabaseLike
		this.secretCodec = options.secretCodec
		this.factorsTable = options.factorsTable ?? 'auth_mfa_factors'
		this.backupCodesTable = options.backupCodesTable ?? 'auth_mfa_backup_codes'
		this.factorColumns = {
			userId: options.factorColumns?.userId ?? 'user_id',
			secret: options.factorColumns?.secret ?? 'secret',
			enabledAt: options.factorColumns?.enabledAt ?? 'enabled_at',
			updatedAt:
				options.factorColumns?.updatedAt === null
					? null
					: (options.factorColumns?.updatedAt ?? 'updated_at')
		}
		this.backupCodeColumns = {
			userId: options.backupCodeColumns?.userId ?? 'user_id',
			hash: options.backupCodeColumns?.hash ?? 'code_hash',
			createdAt: options.backupCodeColumns?.createdAt ?? 'created_at'
		}
		assertD1Identifiers({
			factorsTable: this.factorsTable,
			backupCodesTable: this.backupCodesTable,
			factorUserId: this.factorColumns.userId,
			factorSecret: this.factorColumns.secret,
			factorEnabledAt: this.factorColumns.enabledAt,
			factorUpdatedAt: this.factorColumns.updatedAt,
			backupUserId: this.backupCodeColumns.userId,
			backupHash: this.backupCodeColumns.hash,
			backupCreatedAt: this.backupCodeColumns.createdAt
		})
	}

	async beginEnrollment(userId: string, secret: string, backupCodes: string[]): Promise<boolean> {
		if (!userId || !secret || backupCodes.length === 0) return false
		const ciphertext = await this.secretCodec.encrypt(secret, userId)
		if (!ciphertext.trim() || ciphertext === secret) {
			throw new Error('@goobits/auth: D1MfaAdapter secret codec returned unencrypted plaintext')
		}
		const updateTimestamp = this.factorColumns.updatedAt
			? `, ${this.factorColumns.updatedAt} = CURRENT_TIMESTAMP`
			: ''
		const factor = this.db
			.prepare(
				`INSERT INTO ${this.factorsTable} (${this.factorColumns.userId}, ${this.factorColumns.secret}, ${this.factorColumns.enabledAt})
				 VALUES (?, ?, NULL)
				 ON CONFLICT (${this.factorColumns.userId}) DO UPDATE SET
				   ${this.factorColumns.secret} = excluded.${this.factorColumns.secret},
				   ${this.factorColumns.enabledAt} = NULL${updateTimestamp}
				 WHERE ${this.factorsTable}.${this.factorColumns.enabledAt} IS NULL
				 RETURNING ${this.factorColumns.userId} AS user_id`
			)
			.bind(userId, ciphertext)
		const pendingFactor = `EXISTS (
			SELECT 1 FROM ${this.factorsTable}
			WHERE ${this.factorColumns.userId} = ?
			  AND ${this.factorColumns.secret} = ?
			  AND ${this.factorColumns.enabledAt} IS NULL
		)`
		const removeCodes = this.db
			.prepare(
				`DELETE FROM ${this.backupCodesTable}
				 WHERE ${this.backupCodeColumns.userId} = ? AND ${pendingFactor}`
			)
			.bind(userId, userId, ciphertext)
		const insertCodes = backupCodes.map((hash) =>
			this.db
				.prepare(
					`INSERT INTO ${this.backupCodesTable} (${this.backupCodeColumns.userId}, ${this.backupCodeColumns.hash})
					 SELECT ?, ? WHERE ${pendingFactor}`
				)
				.bind(userId, hash, userId, ciphertext)
		)
		const results = await this.db.batch([factor, removeCodes, ...insertCodes])
		const factorStored = results[0]?.results?.some((row) => String(row['user_id']) === userId)
		const codesStored = results.slice(2).every((result) => result.meta?.changes === 1)
		return Boolean(factorStored && codesStored)
	}

	async getSecret(userId: string): Promise<string | null> {
		const row = await this.db
			.prepare(
				`SELECT ${this.factorColumns.secret} AS secret
				 FROM ${this.factorsTable} WHERE ${this.factorColumns.userId} = ? LIMIT 1`
			)
			.bind(userId)
			.first()
		const ciphertext = row?.['secret']
		if (typeof ciphertext !== 'string') return null
		const secret = await this.secretCodec.decrypt(ciphertext, userId)
		if (!secret.trim()) throw new Error('@goobits/auth: MFA secret codec returned empty plaintext')
		return secret
	}

	async activateEnrollment(userId: string): Promise<boolean> {
		const updateTimestamp = this.factorColumns.updatedAt
			? `, ${this.factorColumns.updatedAt} = CURRENT_TIMESTAMP`
			: ''
		const row = await this.db
			.prepare(
				`UPDATE ${this.factorsTable} SET ${this.factorColumns.enabledAt} = CURRENT_TIMESTAMP${updateTimestamp}
				 WHERE ${this.factorColumns.userId} = ?
				   AND ${this.factorColumns.enabledAt} IS NULL
				   AND EXISTS (
				     SELECT 1 FROM ${this.backupCodesTable}
				     WHERE ${this.backupCodeColumns.userId} = ?
				   )
				 RETURNING ${this.factorColumns.userId} AS user_id`
			)
			.bind(userId, userId)
			.first()
		return String(row?.['user_id'] ?? '') === userId
	}

	async disableMfa(userId: string): Promise<boolean> {
		const removeCodes = this.db
			.prepare(`DELETE FROM ${this.backupCodesTable} WHERE ${this.backupCodeColumns.userId} = ?`)
			.bind(userId)
		const removeFactor = this.db
			.prepare(
				`DELETE FROM ${this.factorsTable} WHERE ${this.factorColumns.userId} = ?
				 RETURNING ${this.factorColumns.userId} AS user_id`
			)
			.bind(userId)
		const results = await this.db.batch([removeCodes, removeFactor])
		return results[1]?.results?.some((row) => String(row['user_id']) === userId) ?? false
	}

	async getBackupCodes(userId: string): Promise<string[]> {
		const rows = await this.db
			.prepare(
				`SELECT ${this.backupCodeColumns.hash} AS code_hash
				 FROM ${this.backupCodesTable}
				 WHERE ${this.backupCodeColumns.userId} = ?
				 ORDER BY ${this.backupCodeColumns.createdAt} ASC`
			)
			.bind(userId)
			.all()
		return (rows.results ?? []).flatMap((row) =>
			typeof row['code_hash'] === 'string' ? [row['code_hash']] : []
		)
	}

	async consumeBackupCode(userId: string, hash: string): Promise<boolean> {
		const row = await this.db
			.prepare(
				`DELETE FROM ${this.backupCodesTable}
				 WHERE ${this.backupCodeColumns.userId} = ? AND ${this.backupCodeColumns.hash} = ?
				 RETURNING ${this.backupCodeColumns.hash} AS code_hash`
			)
			.bind(userId, hash)
			.first()
		return row?.['code_hash'] === hash
	}

	async getStatus(userId: string): Promise<MfaStatus> {
		const row = await this.db
			.prepare(
				`SELECT factor.${this.factorColumns.enabledAt} AS enabled_at,
				        COUNT(backup.${this.backupCodeColumns.hash}) AS backup_code_count
				 FROM ${this.factorsTable} AS factor
				 LEFT JOIN ${this.backupCodesTable} AS backup
				   ON backup.${this.backupCodeColumns.userId} = factor.${this.factorColumns.userId}
				 WHERE factor.${this.factorColumns.userId} = ?
				 GROUP BY factor.${this.factorColumns.enabledAt}`
			)
			.bind(userId)
			.first()
		const enabledAt = parseDate(row?.['enabled_at'])
		return {
			enabled: enabledAt !== null,
			enabledAt,
			backupCodeCount: Number(row?.['backup_code_count'] ?? 0)
		}
	}
}
