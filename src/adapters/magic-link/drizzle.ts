import { MagicLinkAdapter } from "./base.ts";
import { eq, and } from "drizzle-orm";

export class DrizzleMagicLinkAdapter extends MagicLinkAdapter {
	private db: any;
	private tokensTable: any;
	private columns: {
		id: string;
		userId: string;
		email: string;
		tokenHash: string;
		otpHash: string;
		expiresAt: string;
		createdAt: string;
	};
	/**
	 * @param {Object} db - Drizzle instance
	 * @param {Object} options
	 * @param {Object} options.tokensTable - Drizzle table for magic link tokens
	 * @param {Object} [options.columns]
	 */
	constructor(
		db: any,
		options: {
			tokensTable?: any;
			columns?: Partial<Record<string, string>>;
		} = {},
	) {
		super();
		this.db = db;
		this.tokensTable = options.tokensTable;
		this.columns = {
			id: options.columns?.id || "id",
			userId: options.columns?.userId || "userId",
			email: options.columns?.email || "email",
			tokenHash: options.columns?.tokenHash || "tokenHash",
			otpHash: options.columns?.otpHash || "otpHash",
			expiresAt: options.columns?.expiresAt || "expiresAt",
			createdAt: options.columns?.createdAt || "createdAt",
		};

		if (!this.tokensTable) {
			throw new Error("DrizzleMagicLinkAdapter requires tokensTable option");
		}
	}

	async createToken({
		userId,
		email,
		tokenHash,
		otpHash,
		expiresAt,
		metadata,
	}: {
		userId: string | null;
		email: string;
		tokenHash: string;
		otpHash?: string | null;
		expiresAt: Date;
		metadata?: Record<string, unknown>;
	}) {
		const values = {
			[this.columns.userId]: userId,
			[this.columns.email]: email,
			[this.columns.tokenHash]: tokenHash,
			[this.columns.otpHash]: otpHash ?? null,
			[this.columns.expiresAt]: expiresAt,
			...metadata,
		};

		const [token] = await this.db
			.insert(this.tokensTable)
			.values(values)
			.returning();
		return token;
	}

	async findByTokenHash(tokenHash: string) {
		const [token] = await this.db
			.select()
			.from(this.tokensTable)
			.where(eq(this.tokensTable[this.columns.tokenHash], tokenHash));
		if (!token) return null;
		return {
			id: token[this.columns.id],
			userId: token[this.columns.userId],
			email: token[this.columns.email],
			tokenHash: token[this.columns.tokenHash],
			otpHash: token[this.columns.otpHash],
			expiresAt: token[this.columns.expiresAt],
			createdAt: token[this.columns.createdAt] ?? null,
		};
	}

	async findByEmailAndOtpHash({
		email,
		otpHash,
	}: {
		email: string;
		otpHash: string;
	}) {
		const [token] = await this.db
			.select()
			.from(this.tokensTable)
			.where(
				and(
					eq(this.tokensTable[this.columns.email], email),
					eq(this.tokensTable[this.columns.otpHash], otpHash),
				),
			);
		if (!token) return null;
		return {
			id: token[this.columns.id],
			userId: token[this.columns.userId],
			email: token[this.columns.email],
			tokenHash: token[this.columns.tokenHash],
			otpHash: token[this.columns.otpHash],
			expiresAt: token[this.columns.expiresAt],
			createdAt: token[this.columns.createdAt] ?? null,
		};
	}

	async deleteById(tokenId: string) {
		await this.db
			.delete(this.tokensTable)
			.where(eq(this.tokensTable[this.columns.id], tokenId));
	}

	async deleteByUserId(userId: string) {
		await this.db
			.delete(this.tokensTable)
			.where(eq(this.tokensTable[this.columns.userId], userId));
	}

	async deleteByEmail(email: string) {
		await this.db
			.delete(this.tokensTable)
			.where(eq(this.tokensTable[this.columns.email], email));
	}
}
