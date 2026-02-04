import { TokenAdapter } from "./base.js";
import { encryptTokens, decryptTokens } from "../../utils/crypto.js";
import { eq, and } from "drizzle-orm";

/**
 * Drizzle ORM Token Adapter
 * Stores encrypted OAuth tokens in database
 */
export class DrizzleTokenAdapter extends TokenAdapter {
	/**
	 * @param {Object} db - Drizzle database instance
	 * @param {Object} options - Configuration options
	 * @param {Object} options.tokensTable - Drizzle OAuth tokens table schema
	 * @param {string} options.encryptionKey - 32-byte hex encryption key
	 * @param {boolean} [options.encrypt=true] - Whether to encrypt tokens
	 */
	constructor(db, options = {}) {
		super();
		this.db = db;
		this.tokensTable = options.tokensTable;
		this.encryptionKey = options.encryptionKey;
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

	async storeTokens(userId, provider, tokens) {
		const tokenData = this.encrypt
			? await encryptTokens(tokens, this.encryptionKey)
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

	async getTokens(userId, provider) {
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

		return this.encrypt
			? await decryptTokens(result.tokens, this.encryptionKey)
			: JSON.parse(result.tokens);
	}

	async refreshTokens(userId, provider) {
		// This would need to be implemented with provider-specific refresh logic
		// For now, just return the existing tokens
		// In a full implementation, this would call the OAuth provider's refresh endpoint
		throw new Error(
			"refreshTokens not implemented - use provider-specific refresh logic",
		);
	}

	async deleteTokens(userId, provider) {
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
