import { TokenAdapter } from "./base.js";
import { encryptTokens, decryptTokens } from "../../utils/crypto.js";
import type { OAuthTokens } from "../../types/index.js";

type D1Value = string | number | boolean | null;
type D1Row = Record<string, D1Value>;

type D1DatabaseLike = {
	prepare: (sql: string) => {
		bind: (...args: D1Value[]) => {
			run: () => Promise<void>;
			first: () => Promise<D1Row | null>;
		};
	};
};

function isObjectRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === "object";
}

function parseOAuthTokens(raw: string): OAuthTokens | null {
	try {
		const data: unknown = JSON.parse(raw);
		if (!isObjectRecord(data)) return null;
		const record = data;
		if (typeof record["accessToken"] !== "string") return null;
		if (record["refreshToken"] !== null && typeof record["refreshToken"] !== "string") {
			return null;
		}
		if (record["scope"] !== null && typeof record["scope"] !== "string") return null;
		if (typeof record["accessTokenExpiresAt"] !== "string") return null;
		return {
			accessToken: record["accessToken"],
			refreshToken: record["refreshToken"],
			scope: record["scope"],
			accessTokenExpiresAt: record["accessTokenExpiresAt"],
		};
	} catch {
		return null;
	}
}

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
			userId: options.columns?.["userId"] || "user_id",
			provider: options.columns?.["provider"] || "provider",
			tokens: options.columns?.["tokens"] || "tokens",
		};

		if (this.encrypt && !this.encryptionKey) {
			throw new Error(
				"D1TokenAdapter requires encryptionKey when encryption is enabled",
			);
		}
	}

	async storeTokens(userId: string, provider: string, tokens: Record<string, unknown>) {
		const key = this.encryptionKey ?? "";
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
		const key = this.encryptionKey ?? "";
		const tokenValue = row["tokens"];
		if (typeof tokenValue !== "string") return null;
		return this.encrypt
			? await decryptTokens<OAuthTokens>(tokenValue, key)
			: parseOAuthTokens(tokenValue);
	}

	async refreshTokens(userId: string, provider: string) {
		const { getLogger } = await import("../../utils/logger.js");
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
