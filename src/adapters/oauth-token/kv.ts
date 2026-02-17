import { TokenAdapter } from "./base.js";
import { encryptTokens, decryptTokens } from "../../utils/crypto.js";

type KVNamespaceLike = {
	put: (key: string, value: string) => Promise<void>;
	get: (key: string) => Promise<string | null>;
	delete: (key: string) => Promise<void>;
};

export class KVTokenAdapter extends TokenAdapter {
	private namespace: KVNamespaceLike;
	private encrypt: boolean;
	private encryptionKey: string | null;
	private keyPrefix: string;

	constructor(
		namespace: KVNamespaceLike,
		options: {
			encrypt?: boolean;
			encryptionKey?: string | null;
			keyPrefix?: string;
		} = {},
	) {
		super();
		this.namespace = namespace;
		this.encrypt = options.encrypt !== false;
		this.encryptionKey = options.encryptionKey || null;
		this.keyPrefix = options.keyPrefix || "oauth_tokens";

		if (this.encrypt && !this.encryptionKey) {
			throw new Error("KVTokenAdapter requires encryptionKey when encryption is enabled");
		}
	}

	_key(userId: string, provider: string) {
		return `${this.keyPrefix}:${userId}:${provider}`;
	}

	async storeTokens(userId: string, provider: string, tokens: Record<string, unknown>) {
		const key = this.encryptionKey as string;
		const tokenData = this.encrypt
			? await encryptTokens(tokens, key)
			: JSON.stringify(tokens);
		await this.namespace.put(this._key(userId, provider), tokenData);
	}

	async getTokens(userId: string, provider: string) {
		const raw = await this.namespace.get(this._key(userId, provider));
		if (!raw) return null;
		const key = this.encryptionKey as string;
		return this.encrypt
			? await decryptTokens(raw, key)
			: JSON.parse(raw);
	}

	async refreshTokens(
		userId: string,
		provider: string,
	): Promise<import("../../types/index.js").OAuthTokens | null> {
		throw new Error(
			"refreshTokens not implemented - use provider-specific refresh logic",
		);
	}

	async deleteTokens(userId: string, provider: string) {
		await this.namespace.delete(this._key(userId, provider));
	}
}
