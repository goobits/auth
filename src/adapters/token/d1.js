import { TokenAdapter } from "./base.js";
import { encryptTokens, decryptTokens } from "../../utils/crypto.js";

export class D1TokenAdapter extends TokenAdapter {
	constructor(db, options = {}) {
		super();
		this.db = db;
		this.tokensTable = options.tokensTable || "oauth_tokens";
		this.encrypt = options.encrypt !== false;
		this.encryptionKey = options.encryptionKey || null;
		this.columns = {
			userId: options.columns?.userId || "user_id",
			provider: options.columns?.provider || "provider",
			tokens: options.columns?.tokens || "tokens",
		};

		if (this.encrypt && !this.encryptionKey) {
			throw new Error(
				"D1TokenAdapter requires encryptionKey when encryption is enabled",
			);
		}
	}

	async storeTokens(userId, provider, tokens) {
		const tokenData = this.encrypt
			? await encryptTokens(tokens, this.encryptionKey)
			: JSON.stringify(tokens);

		await this.db
			.prepare(
				`DELETE FROM ${this.tokensTable} WHERE ${this.columns.userId} = ? AND ${this.columns.provider} = ?`,
			)
			.bind(userId, provider)
			.run();

		await this.db
			.prepare(
				`INSERT INTO ${this.tokensTable} (${this.columns.userId}, ${this.columns.provider}, ${this.columns.tokens}) VALUES (?, ?, ?)`,
			)
			.bind(userId, provider, tokenData)
			.run();
	}

	async getTokens(userId, provider) {
		const row = await this.db
			.prepare(
				`SELECT ${this.columns.tokens} as tokens FROM ${this.tokensTable} WHERE ${this.columns.userId} = ? AND ${this.columns.provider} = ? LIMIT 1`,
			)
			.bind(userId, provider)
			.first();

		if (!row) return null;
		return this.encrypt
			? await decryptTokens(row.tokens, this.encryptionKey)
			: JSON.parse(row.tokens);
	}

	async refreshTokens(userId, provider) {
		console.warn(
			"refreshTokens not implemented - use provider-specific refresh logic",
		);
		return this.getTokens(userId, provider);
	}

	async deleteTokens(userId, provider) {
		await this.db
			.prepare(
				`DELETE FROM ${this.tokensTable} WHERE ${this.columns.userId} = ? AND ${this.columns.provider} = ?`,
			)
			.bind(userId, provider)
			.run();
	}
}
