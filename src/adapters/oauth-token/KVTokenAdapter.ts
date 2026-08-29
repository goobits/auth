import type { OAuthTokens } from '../../types/index.ts'
import type { OAuthTokenCodec, OAuthTokenEncryptionOptions } from './OAuthTokenCodec.ts'
import { resolveOAuthTokenCodec } from './_tokenEncryption.ts'
import { openOAuthTokens, serializeOAuthTokens } from './_tokenPayload.ts'
import { TokenAdapter } from './TokenAdapter.ts'

type KVNamespaceLike = {
	put: (key: string, value: string) => Promise<void>
	get: (key: string) => Promise<string | null>
	delete: (key: string) => Promise<void>
}

/** KV token adapter for sessions, users, tokens, MFA, magic links, or WebAuthn records. */
export class KVTokenAdapter extends TokenAdapter {
	private namespace: KVNamespaceLike
	private readonly tokenCodec: OAuthTokenCodec | null
	private keyPrefix: string

	constructor(
		namespace: KVNamespaceLike,
		options: OAuthTokenEncryptionOptions & {
			keyPrefix?: string
		} = {}
	) {
		super()
		this.namespace = namespace
		this.tokenCodec = resolveOAuthTokenCodec(options, 'KVTokenAdapter')
		this.keyPrefix = options.keyPrefix || 'oauth_tokens'
	}

	_key(userId: string, provider: string) {
		return `${this.keyPrefix}:${userId}:${provider}`
	}

	async storeTokens(userId: string, provider: string, tokens: OAuthTokens) {
		const tokenData = await serializeOAuthTokens(tokens, this.tokenCodec, { userId, provider })
		await this.namespace.put(this._key(userId, provider), tokenData)
	}

	async getTokens(userId: string, provider: string) {
		const raw = await this.namespace.get(this._key(userId, provider))
		if (!raw) return null
		return openOAuthTokens({
			value: raw,
			codec: this.tokenCodec,
			context: { userId, provider },
			reseal: (ciphertext) => this.namespace.put(this._key(userId, provider), ciphertext)
		})
	}

	async deleteTokens(userId: string, provider: string) {
		await this.namespace.delete(this._key(userId, provider))
	}
}
