import { VerificationTokenAdapter } from "./base.js";
import type { User, VerificationToken } from "../../types/index.js";

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

type TokenUserRecord = {
	token: VerificationToken;
	user: User;
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
			id: options.columns?.["id"] || "id",
			userId: options.columns?.["userId"] || "user_id",
			type: options.columns?.["type"] || "type",
			token: options.columns?.["token"] || "token",
			expiresAt: options.columns?.["expiresAt"] || "expires_at",
		};
		this.userColumns = {
			id: options.userColumns?.["id"] || "id",
			email: options.userColumns?.["email"] || "email",
			name: options.userColumns?.["name"] || "name",
			avatar: options.userColumns?.["avatar"] || "avatar",
		};
	}

	private coerceDbId(id: string): string | number {
		return /^\d+$/.test(id) ? Number(id) : id;
	}

	private mapTokenAndUser(row: D1Row | null): TokenUserRecord | null {
		if (!row) return null;
		const tokenId = row[this.columns.id];
		const userId = row[this.columns.userId];
		const type = row[this.columns.type];
		const token = row[this.columns.token];
		const expiresAt = row[this.columns.expiresAt];
		const email = row[this.userColumns.email];
		const name = row[this.userColumns.name];
		const avatar = row[this.userColumns.avatar];
		if (
			(typeof tokenId !== "string" && typeof tokenId !== "number") ||
			(typeof userId !== "string" && typeof userId !== "number") ||
			typeof type !== "string" ||
			typeof token !== "string" ||
			typeof expiresAt !== "string" ||
			typeof email !== "string" ||
			typeof name !== "string" ||
			(avatar !== null && typeof avatar !== "string")
		) {
			return null;
		}
		const expiresAtDate = new Date(expiresAt);
		if (Number.isNaN(expiresAtDate.getTime())) return null;
		const tokenRecord: VerificationToken = {
			id: String(tokenId),
			userId: String(userId),
			type,
			token,
			expiresAt: expiresAtDate,
			createdAt: new Date(),
		};
		const user: User = {
			id: String(userId),
			email,
			name,
			avatar,
			emailVerified: true,
		};
		return { token: tokenRecord, user };
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
			.bind(
				crypto.randomUUID(),
				this.coerceDbId(userId),
				type,
				token,
				expiresAt.toISOString(),
			)
			.run();
	}

	async findByToken({ token, type }: { token: string; type: string }): Promise<TokenUserRecord | null> {
		const row = await this.db
			.prepare(
				`SELECT t.*, u.* FROM ${this.tokensTable} t JOIN ${this.usersTable} u ON t.${this.columns.userId} = u.${this.userColumns.id} WHERE t.${this.columns.token} = ? AND t.${this.columns.type} = ? LIMIT 1`,
			)
			.bind(token, type)
			.first();

		return this.mapTokenAndUser(row);
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
			.bind(this.coerceDbId(userId), type)
			.run();
	}
}
