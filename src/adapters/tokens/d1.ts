// @ts-nocheck
import { VerificationTokenAdapter } from "../../utils/tokens.ts";

type D1DatabaseLike = {
	prepare: (sql: string) => {
		bind: (...args: unknown[]) => {
			run: () => Promise<unknown>;
			first: () => Promise<Record<string, unknown> | null>;
		};
	};
};

export class D1VerificationTokenAdapter extends VerificationTokenAdapter {
	private db: D1DatabaseLike;
	private tokensTable: string;
	private usersTable: string;
	private columns: {
		id: string;
		userId: string;
		type: string;
		token: string;
		expiresAt: string;
	};
	private userColumns: {
		id: string;
		email: string;
		name: string;
		avatar: string;
		password: string;
	};

	constructor(
		db: D1DatabaseLike,
		options: {
			tokensTable?: string;
			usersTable?: string;
			columns?: Partial<Record<string, string>>;
			userColumns?: Partial<Record<string, string>>;
		} = {},
	) {
		super();
		this.db = db;
		this.tokensTable = options.tokensTable || "verification_tokens";
		this.usersTable = options.usersTable || "users";
		this.columns = {
			id: options.columns?.id || "id",
			userId: options.columns?.userId || "user_id",
			type: options.columns?.type || "type",
			token: options.columns?.token || "token",
			expiresAt: options.columns?.expiresAt || "expires_at",
		};
		this.userColumns = {
			id: options.userColumns?.id || "id",
			email: options.userColumns?.email || "email",
			name: options.userColumns?.name || "name",
			avatar: options.userColumns?.avatar || "avatar",
			password: options.userColumns?.password || "password",
		};
		if (!this.db) {
			throw new Error("D1VerificationTokenAdapter requires a database instance");
		}
	}

	async create({
		userId,
		type,
		token,
		expiresAt,
	}: {
		userId: string;
		type: string;
		token: string;
		expiresAt: Date;
	}) {
		await this.db
			.prepare(
				`INSERT INTO ${this.tokensTable} (${this.columns.id}, ${this.columns.userId}, ${this.columns.type}, ${this.columns.token}, ${this.columns.expiresAt}) VALUES (?, ?, ?, ?, ?)`,
			)
			.bind(crypto.randomUUID(), userId, type, token, expiresAt.toISOString())
			.run();
	}

	async findByToken({ token, type }: { token: string; type: string }) {
		const row = await this.db
			.prepare(
				`SELECT t.*, u.* FROM ${this.tokensTable} t JOIN ${this.usersTable} u ON t.${this.columns.userId} = u.${this.userColumns.id} WHERE t.${this.columns.token} = ? AND t.${this.columns.type} = ? LIMIT 1`,
			)
			.bind(token, type)
			.first();

		if (!row) return null;

		const tokenRecord = {
			id: row[this.columns.id],
			userId: row[this.columns.userId],
			type: row[this.columns.type],
			token: row[this.columns.token],
			expiresAt: new Date(row[this.columns.expiresAt] as string),
		};

		const user = {
			id: row[this.userColumns.id],
			email: row[this.userColumns.email],
			name: row[this.userColumns.name],
			avatar: row[this.userColumns.avatar],
			password: row[this.userColumns.password],
		};

		return { token: tokenRecord, user };
	}

	async deleteById(tokenId: string) {
		await this.db
			.prepare(`DELETE FROM ${this.tokensTable} WHERE ${this.columns.id} = ?`)
			.bind(tokenId)
			.run();
	}

	async deleteByUserAndType({ userId, type }: { userId: string; type: string }) {
		await this.db
			.prepare(
				`DELETE FROM ${this.tokensTable} WHERE ${this.columns.userId} = ? AND ${this.columns.type} = ?`,
			)
			.bind(userId, type)
			.run();
	}
}
