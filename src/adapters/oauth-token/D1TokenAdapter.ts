import type { OAuthTokens } from '../../types/index.ts'
import { resolveLogger, type Logger } from '../../_internal/logger.ts'
import { assertD1Identifier } from '../_d1Sql.ts'
import type { OAuthTokenCodec, OAuthTokenEncryptionOptions } from './OAuthTokenCodec.ts'
import { resolveOAuthTokenCodec } from './_tokenEncryption.ts'
import { openOAuthTokens, serializeOAuthTokens } from './_tokenPayload.ts'
import { TokenAdapter } from './TokenAdapter.ts'

type D1Value = string | number | boolean | null
type D1Row = Record<string, D1Value>

type D1DatabaseLike = {
	prepare: (sql: string) => {
		bind: (...args: D1Value[]) => {
			run: () => Promise<void>
			first: () => Promise<D1Row | null>
		}
	}
}

/** Cloudflare D1 token adapter for sessions, users, tokens, MFA, magic links, or WebAuthn records. */
export class D1TokenAdapter extends TokenAdapter {
	private db: D1DatabaseLike
	private tokensTable: string
	private readonly tokenCodec: OAuthTokenCodec | null
	private columns: { userId: string; provider: string; tokens: string }
	private readonly logger: Logger

	constructor(
		db: D1DatabaseLike,
		options: OAuthTokenEncryptionOptions & {
			tokensTable?: string
			columns?: Partial<Record<string, string>>
			logger?: Logger
		} = {}
	) {
		super()
		this.db = db
		this.tokensTable = assertD1Identifier(options.tokensTable || 'oauth_tokens', 'tokensTable')
		this.tokenCodec = resolveOAuthTokenCodec(options, 'D1TokenAdapter')
		this.logger = resolveLogger(options.logger)
		this.columns = {
			userId: assertD1Identifier(options.columns?.['userId'] || 'user_id', 'oauthTokens.userId'),
			provider: assertD1Identifier(
				options.columns?.['provider'] || 'provider',
				'oauthTokens.provider'
			),
			tokens: assertD1Identifier(options.columns?.['tokens'] || 'tokens', 'oauthTokens.tokens')
		}
	}

	private async writeTokens(userId: string, provider: string, tokenData: string): Promise<void> {
		await this.db
			.prepare(
				`INSERT INTO ${this.tokensTable} (${this.columns.userId}, ${this.columns.provider}, ${this.columns.tokens})
				 VALUES (?, ?, ?)
				 ON CONFLICT (${this.columns.userId}, ${this.columns.provider})
				 DO UPDATE SET ${this.columns.tokens} = excluded.${this.columns.tokens}`
			)
			.bind(userId, provider, tokenData)
			.run()
	}

	async storeTokens(userId: string, provider: string, tokens: OAuthTokens) {
		const context = { userId, provider }
		await this.writeTokens(
			userId,
			provider,
			await serializeOAuthTokens(tokens, this.tokenCodec, context)
		)
	}

	async getTokens(userId: string, provider: string) {
		const row = await this.db
			.prepare(
				`SELECT ${this.columns.tokens} as tokens FROM ${this.tokensTable} WHERE ${this.columns.userId} = ? AND ${this.columns.provider} = ? LIMIT 1`
			)
			.bind(userId, provider)
			.first()

		if (!row) return null
		const tokenValue = row['tokens']
		if (typeof tokenValue !== 'string') return null
		return openOAuthTokens({
			value: tokenValue,
			codec: this.tokenCodec,
			context: { userId, provider },
			reseal: (ciphertext) => this.writeTokens(userId, provider, ciphertext)
		})
	}

	async refreshTokens(userId: string, provider: string) {
		this.logger.warn('refreshTokens not implemented - use provider-specific refresh logic')
		return this.getTokens(userId, provider)
	}

	async deleteTokens(userId: string, provider: string) {
		await this.db
			.prepare(
				`DELETE FROM ${this.tokensTable} WHERE ${this.columns.userId} = ? AND ${this.columns.provider} = ?`
			)
			.bind(userId, provider)
			.run()
	}
}
