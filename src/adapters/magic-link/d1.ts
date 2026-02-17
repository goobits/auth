import { MagicLinkAdapter } from "./base.js";
import type { MagicLinkToken } from "../../types/index.js";

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

export class D1MagicLinkAdapter extends MagicLinkAdapter {
	private db: D1DatabaseLike;
	private tokensTable: string;
	private columns: {
		id: string;
		userId: string;
		email: string;
		tokenHash: string;
		otpHash: string;
		expiresAt: string;
		createdAt: string;
	};

	constructor(
		db: D1DatabaseLike,
		options: {
			tokensTable?: string;
			columns?: Partial<Record<string, string>>;
		} = {},
	) {
		super();
		this.db = db;
		this.tokensTable = options.tokensTable || "magic_link_tokens";
		this.columns = {
			id: options.columns?.["id"] || "id",
			userId: options.columns?.["userId"] || "user_id",
			email: options.columns?.["email"] || "email",
			tokenHash: options.columns?.["tokenHash"] || "token_hash",
			otpHash: options.columns?.["otpHash"] || "otp_hash",
			expiresAt: options.columns?.["expiresAt"] || "expires_at",
			createdAt: options.columns?.["createdAt"] || "created_at",
		};
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
		const id = crypto.randomUUID();
		const sql = `INSERT INTO ${this.tokensTable} (${this.columns.id}, ${this.columns.userId}, ${this.columns.email}, ${this.columns.tokenHash}, ${this.columns.otpHash}, ${this.columns.expiresAt}) VALUES (?, ?, ?, ?, ?, ?)`;
		await this.db
			.prepare(sql)
			.bind(id, userId, email, tokenHash, otpHash ?? null, expiresAt.toISOString())
			.run();
		return {
			id,
			userId,
			email,
			tokenHash,
			otpHash: otpHash ?? null,
			expiresAt,
			createdAt: new Date(),
			...metadata,
		};
	}

	async findByTokenHash(tokenHash: string): Promise<MagicLinkToken | null> {
		const sql = `SELECT * FROM ${this.tokensTable} WHERE ${this.columns.tokenHash} = ? LIMIT 1`;
		const row = await this.db.prepare(sql).bind(tokenHash).first();
		return this.mapRow(row);
	}

	async findByEmailAndOtpHash({
		email,
		otpHash,
	}: {
		email: string;
		otpHash: string;
	}): Promise<MagicLinkToken | null> {
		const sql = `SELECT * FROM ${this.tokensTable} WHERE ${this.columns.email} = ? AND ${this.columns.otpHash} = ? LIMIT 1`;
		const row = await this.db.prepare(sql).bind(email, otpHash).first();
		return this.mapRow(row);
	}

	async deleteById(tokenId: string) {
		await this.db
			.prepare(`DELETE FROM ${this.tokensTable} WHERE ${this.columns.id} = ?`)
			.bind(tokenId)
			.run();
	}

	async deleteByUserId(userId: string) {
		await this.db
			.prepare(`DELETE FROM ${this.tokensTable} WHERE ${this.columns.userId} = ?`)
			.bind(userId)
			.run();
	}

	async deleteByEmail(email: string) {
		await this.db
			.prepare(`DELETE FROM ${this.tokensTable} WHERE ${this.columns.email} = ?`)
			.bind(email)
			.run();
	}

	private mapRow(row: D1Row | null): MagicLinkToken | null {
		if (!row) return null;
		const id = row[this.columns["id"]] ?? row["id"];
		const userId = row[this.columns.userId] ?? row["user_id"];
		const email = row[this.columns["email"]] ?? row["email"];
		const tokenHash = row[this.columns.tokenHash] ?? row["token_hash"];
		const otpHash = row[this.columns.otpHash] ?? row["otp_hash"];
		const expiresAt = row[this.columns.expiresAt] ?? row["expires_at"];
		const createdAt = row[this.columns.createdAt] ?? row["created_at"];
		if (typeof id !== "string") return null;
		if (userId !== null && typeof userId !== "string") return null;
		if (typeof email !== "string") return null;
		if (typeof tokenHash !== "string") return null;
		if (otpHash !== null && typeof otpHash !== "string") return null;
		if (typeof expiresAt !== "string") return null;
		const expiresAtDate = new Date(expiresAt);
		if (Number.isNaN(expiresAtDate.getTime())) return null;
		const createdAtDate =
			typeof createdAt === "string" && !Number.isNaN(new Date(createdAt).getTime())
				? new Date(createdAt)
				: new Date();
		return {
			id,
			userId,
			email,
			tokenHash,
			otpHash,
			expiresAt: expiresAtDate,
			createdAt: createdAtDate,
		};
	}
}
