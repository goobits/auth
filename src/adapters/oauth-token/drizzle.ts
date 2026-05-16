import { TokenAdapter } from "./base.js";
import { and, eq } from "drizzle-orm";
import { decryptTokens, encryptTokens } from "../../utils/crypto.js";
import type { OAuthTokens } from "../../types/index.js";
import {
	requireCondition,
	requireColumn,
	type DrizzleDbLike,
	type DrizzleJson,
	type DrizzleTable,
} from "../drizzle-types.js";

type TokensTable = DrizzleTable & {
	userId: DrizzleTable[string];
	provider: DrizzleTable[string];
	tokens: DrizzleTable[string];
};

function normalizeOAuthTokens(value: DrizzleJson): OAuthTokens | null {
	if (!value || typeof value !== "object" || Array.isArray(value) || value instanceof Date) {
		return null;
	}
	const accessTokenRaw = value["accessToken"];
	const refreshTokenRaw = value["refreshToken"];
	const scopeRaw = value["scope"];
	const accessTokenExpiresAtRaw = value["accessTokenExpiresAt"];
	if (typeof accessTokenRaw !== "string") return null;
	const refreshToken =
		typeof refreshTokenRaw === "string" || refreshTokenRaw === null
			? refreshTokenRaw
			: null;
	const scope =
		typeof scopeRaw === "string" || scopeRaw === null
			? scopeRaw
			: null;
	let accessTokenExpiresAt: string;
	if (typeof accessTokenExpiresAtRaw === "string") {
		accessTokenExpiresAt = accessTokenExpiresAtRaw;
	} else if (accessTokenExpiresAtRaw instanceof Date) {
		accessTokenExpiresAt = accessTokenExpiresAtRaw.toISOString();
	} else {
		accessTokenExpiresAt = new Date().toISOString();
	}
	return {
		accessToken: accessTokenRaw,
		refreshToken,
		scope,
		accessTokenExpiresAt,
	};
}

export class DrizzleTokenAdapter extends TokenAdapter {
	private db: DrizzleDbLike;
	private tokensTable: TokensTable;
	private encryptionKey: string | null;
	private encrypt: boolean;

	constructor(
		db: DrizzleDbLike,
		options: {
			tokensTable?: TokensTable;
			encryptionKey?: string | null;
			encrypt?: boolean;
		} = {},
	) {
		super();
		if (!options.tokensTable) {
			throw new Error("DrizzleTokenAdapter requires tokensTable option");
		}
		this.db = db;
		this.tokensTable = options.tokensTable;
		this.encryptionKey = options.encryptionKey ?? null;
		this.encrypt = options.encrypt !== false;
		if (this.encrypt && !this.encryptionKey) {
			throw new Error(
				"DrizzleTokenAdapter requires encryptionKey when encryption is enabled",
			);
		}
	}

	private getEncryptionKey(): string {
		if (!this.encryptionKey) {
			throw new Error("Encryption key is required");
		}
		return this.encryptionKey;
	}

	async storeTokens(userId: string, provider: string, tokens: OAuthTokens): Promise<void> {
	const key = this.getEncryptionKey();
		const tokenData = this.encrypt
			? await encryptTokens(tokens, key)
			: JSON.stringify(tokens);
		await this.db
			.delete(this.tokensTable)
			.where(
				requireCondition(and(
					eq(requireColumn(this.tokensTable, "userId"), userId),
					eq(requireColumn(this.tokensTable, "provider"), provider),
				)),
			);
		await this.db.insert(this.tokensTable).values({
			userId,
			provider,
			tokens: tokenData,
		});
	}

	async getTokens(userId: string, provider: string): Promise<OAuthTokens | null> {
		const [row] = await this.db
			.select()
			.from(this.tokensTable)
			.where(
				requireCondition(and(
					eq(requireColumn(this.tokensTable, "userId"), userId),
					eq(requireColumn(this.tokensTable, "provider"), provider),
				)),
			);
		if (!row) return null;
		const raw = row["tokens"];
		if (typeof raw !== "string") return null;
		if (this.encrypt) {
			const decrypted = await decryptTokens<DrizzleJson>(raw, this.getEncryptionKey());
			return decrypted ? normalizeOAuthTokens(decrypted) : null;
		}
		const parsed: DrizzleJson = JSON.parse(raw);
		return normalizeOAuthTokens(parsed);
	}

	async refreshTokens(_userId: string, _provider: string): Promise<OAuthTokens | null> {
		throw new Error(
			"refreshTokens not implemented - use provider-specific refresh logic",
		);
	}

	async deleteTokens(userId: string, provider: string): Promise<void> {
		await this.db
			.delete(this.tokensTable)
			.where(
				requireCondition(and(
					eq(requireColumn(this.tokensTable, "userId"), userId),
					eq(requireColumn(this.tokensTable, "provider"), provider),
				)),
			);
	}
}
