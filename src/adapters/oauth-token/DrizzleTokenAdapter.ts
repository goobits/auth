import { and, eq } from 'drizzle-orm'

import type { OAuthTokens } from '../../types/index.ts'
import {
	type DrizzleDbLike,
	type InsertConflictQuery,
	type DrizzleTable,
	requireColumn,
	requireCondition
} from '../drizzleTypes.ts'
import type { OAuthTokenCodec, OAuthTokenEncryptionOptions } from './OAuthTokenCodec.ts'
import { resolveOAuthTokenCodec } from './_tokenEncryption.ts'
import { openOAuthTokens, serializeOAuthTokens } from './_tokenPayload.ts'
import { TokenAdapter } from './TokenAdapter.ts'

type TokensTable = DrizzleTable & {
	userId: DrizzleTable[string]
	provider: DrizzleTable[string]
	tokens: DrizzleTable[string]
}

function supportsAtomicUpsert(value: unknown): value is InsertConflictQuery {
	return (
		value !== null &&
		typeof value === 'object' &&
		'onConflictDoUpdate' in value &&
		typeof value.onConflictDoUpdate === 'function'
	)
}

/** Drizzle token adapter for sessions, users, tokens, MFA, magic links, or WebAuthn records. */
export class DrizzleTokenAdapter extends TokenAdapter {
	private db: DrizzleDbLike
	private tokensTable: TokensTable
	private readonly tokenCodec: OAuthTokenCodec | null

	constructor(
		db: DrizzleDbLike,
		options: OAuthTokenEncryptionOptions & {
			tokensTable?: TokensTable
		} = {}
	) {
		super()
		if (!options.tokensTable) {
			throw new Error('DrizzleTokenAdapter requires tokensTable option')
		}
		this.db = db
		this.tokensTable = options.tokensTable
		this.tokenCodec = resolveOAuthTokenCodec(options, 'DrizzleTokenAdapter')
	}

	private async writeTokens(userId: string, provider: string, tokenData: string): Promise<void> {
		const insert = this.db.insert(this.tokensTable).values({
			userId,
			provider,
			tokens: tokenData
		})
		if (!supportsAtomicUpsert(insert)) {
			throw new TypeError('Drizzle OAuth token storage requires atomic upsert support')
		}
		await insert.onConflictDoUpdate({
			target: [
				requireColumn(this.tokensTable, 'userId'),
				requireColumn(this.tokensTable, 'provider')
			],
			set: { tokens: tokenData }
		})
	}

	async storeTokens(userId: string, provider: string, tokens: OAuthTokens): Promise<void> {
		await this.writeTokens(
			userId,
			provider,
			await serializeOAuthTokens(tokens, this.tokenCodec, { userId, provider })
		)
	}

	async getTokens(userId: string, provider: string): Promise<OAuthTokens | null> {
		const [row] = await this.db
			.select()
			.from(this.tokensTable)
			.where(
				requireCondition(
					and(
						eq(requireColumn(this.tokensTable, 'userId'), userId),
						eq(requireColumn(this.tokensTable, 'provider'), provider)
					)
				)
			)
		if (!row) return null
		const raw = row['tokens']
		if (typeof raw !== 'string') return null
		return openOAuthTokens({
			value: raw,
			codec: this.tokenCodec,
			context: { userId, provider },
			reseal: (ciphertext) => this.writeTokens(userId, provider, ciphertext)
		})
	}

	async refreshTokens(_userId: string, _provider: string): Promise<OAuthTokens | null> {
		throw new Error('refreshTokens not implemented - use provider-specific refresh logic')
	}

	async deleteTokens(userId: string, provider: string): Promise<void> {
		await this.db
			.delete(this.tokensTable)
			.where(
				requireCondition(
					and(
						eq(requireColumn(this.tokensTable, 'userId'), userId),
						eq(requireColumn(this.tokensTable, 'provider'), provider)
					)
				)
			)
	}
}
