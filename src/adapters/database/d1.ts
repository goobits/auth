import { UserAdapter } from "./base.ts";
import type { User } from "../../types/index.ts";

type D1Value = string | number | boolean | null;
type D1Row = Record<string, D1Value>;

type D1DatabaseLike = {
	prepare: (sql: string) => {
		bind: (...args: D1Value[]) => {
			run: () => Promise<{ meta?: { last_row_id?: string | number } } | undefined>;
			first: () => Promise<D1Row | null>;
		};
	};
};

type D1UserAdapterOptions = {
	usersTable?: string;
	oauthAccountsTable?: string;
	sanitizeUser?: (user: User | null) => User | null;
	columns?: Partial<Record<string, string>>;
	oauthColumns?: Partial<Record<string, string>>;
	allowedFields?: string[];
};

export class D1UserAdapter extends UserAdapter {
	db: D1DatabaseLike;
	usersTable: string;
	oauthAccountsTable: string;
	sanitizeUser: (user: User | null) => User | null;
	columns: {
		id: string;
		email: string;
		name: string;
		avatar: string;
		emailVerified: string;
		password: string;
	};
	oauthColumns: {
		userId: string;
		provider: string;
		providerAccountId: string;
	};
	allowedFields: string[];

	constructor(db: D1DatabaseLike, options: D1UserAdapterOptions = {}) {
		super();
		this.db = db;
		this.usersTable = options.usersTable || "users";
		this.oauthAccountsTable = options.oauthAccountsTable || "oauth_accounts";
		this.sanitizeUser = options.sanitizeUser || this._defaultSanitizeUser;
		this.columns = {
			id: options.columns?.["id"] || "id",
			email: options.columns?.["email"] || "email",
			name: options.columns?.["name"] || "name",
			avatar: options.columns?.["avatar"] || "avatar",
			emailVerified: options.columns?.["emailVerified"] || "email_verified",
			password: options.columns?.["password"] || "password",
		};
		this.oauthColumns = {
			userId: options.oauthColumns?.["userId"] || "user_id",
			provider: options.oauthColumns?.["provider"] || "provider",
			providerAccountId:
				options.oauthColumns?.["providerAccountId"] || "provider_account_id",
		};
		this.allowedFields = options.allowedFields || [
			"email",
			"name",
			"avatar",
			"emailVerified",
			"password",
		];
	}

	private mapUser(row: D1Row | null): User | null {
		if (!row) return null;
		const id = row[this.columns["id"]] ?? row["id"];
		const email = row[this.columns["email"]] ?? row["email"];
		const name = row[this.columns["name"]] ?? row["name"];
		const avatar = row[this.columns["avatar"]] ?? row["avatar"];
		const emailVerified = row[this.columns.emailVerified] ?? row["email_verified"];
		if (typeof id !== "string" && typeof id !== "number") return null;
		if (typeof email !== "string") return null;
		if (typeof name !== "string") return null;
		if (avatar !== null && typeof avatar !== "string") return null;
		if (typeof emailVerified !== "boolean" && emailVerified !== 0 && emailVerified !== 1) {
			return null;
		}
		return {
			id: String(id),
			email,
			name,
			avatar,
			emailVerified: Boolean(emailVerified),
		};
	}

	_defaultSanitizeUser(user: User | null): User | null {
		return user;
	}

	async createUser(
		profile: { email: string; name?: string; picture?: string; verified_email?: boolean },
		metadata: Record<string, unknown> = {},
	): Promise<User> {
		const userData = {
			email: profile.email,
			name: profile.name ?? profile.email,
			avatar: profile.picture ?? null,
			emailVerified: Boolean(profile.verified_email),
			...metadata,
		};

		const sql = `INSERT INTO ${this.usersTable} (${this.columns.email}, ${this.columns.name}, ${this.columns.avatar}, ${this.columns.emailVerified}) VALUES (?, ?, ?, ?)`;
		const result = await this.db
			.prepare(sql)
			.bind(userData.email, userData.name, userData.avatar, userData.emailVerified)
			.run();
		const id = result?.meta?.last_row_id;
		if (id === undefined) throw new Error("Failed to create user");
		const created = await this.getUserById(String(id), id);
		if (!created) throw new Error("Created user not found");
		return created;
	}

	async getUserById(id: string, rawId?: string | number): Promise<User | null> {
		const sql = `SELECT * FROM ${this.usersTable} WHERE ${this.columns.id} = ? LIMIT 1`;
		const normalizedRow = await this.db.prepare(sql).bind(id).first();
		if (normalizedRow) {
			return this.sanitizeUser(this.mapUser(normalizedRow));
		}
		if (rawId !== undefined && rawId !== id) {
			const rawRow = await this.db.prepare(sql).bind(rawId).first();
			return this.sanitizeUser(this.mapUser(rawRow));
		}
		return null;
	}

	async getUserByEmail(email: string): Promise<User | null> {
		const sql = `SELECT * FROM ${this.usersTable} WHERE ${this.columns.email} = ? LIMIT 1`;
		const row = await this.db.prepare(sql).bind(email).first();
		return this.sanitizeUser(this.mapUser(row));
	}

	async getUserByProviderId(provider: string, providerId: string): Promise<User | null> {
		const sql = `SELECT u.* FROM ${this.oauthAccountsTable} o
			JOIN ${this.usersTable} u ON o.${this.oauthColumns.userId} = u.${this.columns.id}
			WHERE o.${this.oauthColumns.provider} = ? AND o.${this.oauthColumns.providerAccountId} = ? LIMIT 1`;
		const row = await this.db.prepare(sql).bind(provider, providerId).first();
		return this.sanitizeUser(this.mapUser(row));
	}

	async updateUser(id: string, data: Partial<User> & Record<string, unknown>): Promise<User> {
		const fields = Object.keys(data);
		if (fields.length === 0) {
			const existing = await this.getUserById(id);
			if (!existing) throw new Error("User not found");
			return existing;
		}
		for (const field of fields) {
			if (!this.allowedFields.includes(field)) {
				throw new Error(`Field not allowed for update: ${field}`);
			}
		}
		const mappedFields = fields.map((field) => {
			if (field === "id") return this.columns.id;
			if (field === "email") return this.columns.email;
			if (field === "name") return this.columns.name;
			if (field === "avatar") return this.columns.avatar;
			if (field === "emailVerified") return this.columns.emailVerified;
			if (field === "password") return this.columns.password;
			return field;
		});
		const setClause = mappedFields.map((f) => `${f} = ?`).join(", ");
		const values = fields.map((f) => data[f]);
		const sql = `UPDATE ${this.usersTable} SET ${setClause} WHERE ${this.columns.id} = ?`;
		await this.db
			.prepare(sql)
			.bind(
				...values.map((value) =>
					typeof value === "string" ||
					typeof value === "number" ||
					typeof value === "boolean" ||
					value === null
						? value
						: String(value),
				),
				id,
			)
			.run();
		const updated = await this.getUserById(id);
		if (!updated) throw new Error("Updated user not found");
		return updated;
	}

	async deleteUser(id: string) {
		await this.db
			.prepare(`DELETE FROM ${this.usersTable} WHERE ${this.columns.id} = ?`)
			.bind(id)
			.run();
	}

	async linkOAuthAccount(userId: string, provider: string, providerAccountId: string): Promise<void> {
		const sql = `INSERT INTO ${this.oauthAccountsTable} (${this.oauthColumns.userId}, ${this.oauthColumns.provider}, ${this.oauthColumns.providerAccountId}) VALUES (?, ?, ?)`;
		await this.db.prepare(sql).bind(userId, provider, providerAccountId).run();
	}

	async getUserWithPasswordHash(email: string): Promise<(User & { password?: string | null }) | null> {
		const sql = `SELECT * FROM ${this.usersTable} WHERE ${this.columns.email} = ? LIMIT 1`;
		const row = await this.db.prepare(sql).bind(email).first();
		const mapped = this.mapUser(row);
		if (!mapped) return null;
		const password = row?.[this.columns["password"]] ?? row?.["password"];
		return {
			...mapped,
			password: typeof password === "string" ? password : null,
		};
	}
}
