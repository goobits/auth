import { MagicLinkAdapter } from "./base.js";

export class D1MagicLinkAdapter extends MagicLinkAdapter {
	constructor(db, options = {}) {
		super();
		this.db = db;
		this.tokensTable = options.tokensTable || "magic_link_tokens";
		this.columns = {
			id: options.columns?.id || "id",
			userId: options.columns?.userId || "user_id",
			email: options.columns?.email || "email",
			tokenHash: options.columns?.tokenHash || "token_hash",
			otpHash: options.columns?.otpHash || "otp_hash",
			expiresAt: options.columns?.expiresAt || "expires_at",
			createdAt: options.columns?.createdAt || "created_at",
		};
	}

	async createToken({ userId, email, tokenHash, otpHash, expiresAt, metadata }) {
		const sql = `INSERT INTO ${this.tokensTable} (${this.columns.userId}, ${this.columns.email}, ${this.columns.tokenHash}, ${this.columns.otpHash}, ${this.columns.expiresAt}) VALUES (?, ?, ?, ?, ?)`;
		await this.db
			.prepare(sql)
			.bind(userId, email, tokenHash, otpHash ?? null, expiresAt.toISOString())
			.run();
		return { userId, email, tokenHash, otpHash, expiresAt, ...metadata };
	}

	async findByTokenHash(tokenHash) {
		const sql = `SELECT * FROM ${this.tokensTable} WHERE ${this.columns.tokenHash} = ? LIMIT 1`;
		const row = await this.db.prepare(sql).bind(tokenHash).first();
		if (!row) return null;
		return {
			id: row[this.columns.id] ?? row.id,
			userId: row[this.columns.userId] ?? row.user_id,
			email: row[this.columns.email] ?? row.email,
			tokenHash: row[this.columns.tokenHash] ?? row.token_hash,
			otpHash: row[this.columns.otpHash] ?? row.otp_hash,
			expiresAt: row[this.columns.expiresAt] ?? row.expires_at,
			createdAt: row[this.columns.createdAt] ?? row.created_at ?? null,
		};
	}

	async findByEmailAndOtpHash({ email, otpHash }) {
		const sql = `SELECT * FROM ${this.tokensTable} WHERE ${this.columns.email} = ? AND ${this.columns.otpHash} = ? LIMIT 1`;
		const row = await this.db.prepare(sql).bind(email, otpHash).first();
		if (!row) return null;
		return {
			id: row[this.columns.id] ?? row.id,
			userId: row[this.columns.userId] ?? row.user_id,
			email: row[this.columns.email] ?? row.email,
			tokenHash: row[this.columns.tokenHash] ?? row.token_hash,
			otpHash: row[this.columns.otpHash] ?? row.otp_hash,
			expiresAt: row[this.columns.expiresAt] ?? row.expires_at,
			createdAt: row[this.columns.createdAt] ?? row.created_at ?? null,
		};
	}

	async deleteById(tokenId) {
		await this.db
			.prepare(`DELETE FROM ${this.tokensTable} WHERE ${this.columns.id} = ?`)
			.bind(tokenId)
			.run();
	}

	async deleteByUserId(userId) {
		await this.db
			.prepare(`DELETE FROM ${this.tokensTable} WHERE ${this.columns.userId} = ?`)
			.bind(userId)
			.run();
	}

	async deleteByEmail(email) {
		await this.db
			.prepare(`DELETE FROM ${this.tokensTable} WHERE ${this.columns.email} = ?`)
			.bind(email)
			.run();
	}
}
