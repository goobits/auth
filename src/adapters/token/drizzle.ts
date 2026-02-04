import { TokenAdapter } from "./base.ts";
import { encryptTokens, decryptTokens } from "../../utils/crypto.ts";
import { eq, and } from "drizzle-orm";

/**
 * Drizzle ORM Token Adapter
 * Stores encrypted OAuth tokens in database
 */
export class DrizzleTokenAdapter extends TokenAdapter {
	private db: any;
	private tokensTable: any;
	private encryptionKey: string | null;
	private encrypt: boolean;
	/**
	 * @param {Object} db - Drizzle database instance
	 * @param {Object} options - Configuration options
	 * @param {Object} options.tokensTable - Drizzle OAuth tokens table schema
	 * @param {string} options.encryptionKey - 32-byte hex encryption key
	 * @param {boolean} [options.encrypt=true] - Whether to encrypt tokens
	 */
	constructor(
		db: any,
		options: {
			tokensTable?: any;
			encryptionKey?: string | null;
			encrypt?: boolean;
		} = {},
	) {
		super();
		this.db = db;
		this.tokensTable = options.tokensTable;
		this.encryptionKey = options.encryptionKey ?? null;
		this.encrypt = options.encrypt !== false;

		if (!this.tokensTable) {
			throw new Error("DrizzleTokenAdapter requires tokensTable option");
		}

		if (this.encrypt && !this.encryptionKey) {
			throw new Error(
				"DrizzleTokenAdapter requires encryptionKey when encryption is enabled",
			);
		}
	}

	async storeTokens(userId: string, provider: string, tokens: any) {
		const key = this.encryptionKey as string;
		const tokenData = this.encrypt
			? await encryptTokens(tokens, key)
			: JSON.stringify(tokens);

		// Delete existing tokens for this user/provider
		await this.db
			.delete(this.tokensTable)
			.where(
				and(
					eq(this.tokensTable.userId, userId),
					eq(this.tokensTable.provider, provider),
				),
			);

		// Insert new tokens
		await this.db.insert(this.tokensTable).values({
			userId,
			provider,
			tokens: tokenData,
		});
	}

	async getTokens(userId: string, provider: string) {
		const [result] = await this.db
			.select()
			.from(this.tokensTable)
			.where(
				and(
					eq(this.tokensTable.userId, userId),
					eq(this.tokensTable.provider, provider),
				),
			);

		if (!result) return null;

		const key = this.encryptionKey as string;
		return this.encrypt
			? await decryptTokens(result.tokens, key)
			: JSON.parse(result.tokens);
	}

	async refreshTokens(
		userId: string,
		provider: string,
	): Promise<import("../../types/index.ts").OAuthTokens | null> {
		// This would need to be implemented with provider-specific refresh logic
		// For now, just return the existing tokens
		// In a full implementation, this would call the OAuth provider's refresh endpoint
		throw new Error(
			"refreshTokens not implemented - use provider-specific refresh logic",
		);
	}

	async deleteTokens(userId: string, provider: string) {
		await this.db
			.delete(this.tokensTable)
			.where(
				and(
					eq(this.tokensTable.userId, userId),
					eq(this.tokensTable.provider, provider),
				),
			);
	}
}
