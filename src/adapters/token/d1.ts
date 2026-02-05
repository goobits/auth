// @ts-nocheck
import { TokenAdapter } from "./base.ts";
import { encryptTokens, decryptTokens } from "../../utils/crypto.ts";

type D1DatabaseLike = {
	prepare: (sql: string) => {
		bind: (...args: unknown[]) => {
			run: () => Promise<unknown>;
			first: () => Promise<Record<string, unknown> | null>;
		};
	};
};

export class D1TokenAdapter extends TokenAdapter {
	private db: D1DatabaseLike;
	private tokensTable: string;
	private encrypt: boolean;
	private encryptionKey: string | null;
	private columns: { userId: string; provider: string; tokens: string };

	constructor(
		db: D1DatabaseLike,
		options: {
			tokensTable?: string;
			encrypt?: boolean;
			encryptionKey?: string | null;
			columns?: Partial<Record<string, string>>;
		} = {},
	) {
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

	async storeTokens(userId: string, provider: string, tokens: Record<string, unknown>) {
		const key = this.encryptionKey as string;
		const tokenData = this.encrypt
			? await encryptTokens(tokens, key)
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

	async getTokens(userId: string, provider: string) {
		const row = await this.db
			.prepare(
				`SELECT ${this.columns.tokens} as tokens FROM ${this.tokensTable} WHERE ${this.columns.userId} = ? AND ${this.columns.provider} = ? LIMIT 1`,
			)
			.bind(userId, provider)
			.first();

		if (!row) return null;
		const key = this.encryptionKey as string;
		return this.encrypt
			? await decryptTokens(row.tokens, key)
			: JSON.parse(row.tokens);
	}

	async refreshTokens(userId: string, provider: string) {
		const { getLogger } = await import("../../utils/logger.ts");
		getLogger().warn?.(
			"refreshTokens not implemented - use provider-specific refresh logic",
		);
		return this.getTokens(userId, provider);
	}

	async deleteTokens(userId: string, provider: string) {
		await this.db
			.prepare(
				`DELETE FROM ${this.tokensTable} WHERE ${this.columns.userId} = ? AND ${this.columns.provider} = ?`,
			)
			.bind(userId, provider)
			.run();
	}
}
