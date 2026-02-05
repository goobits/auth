import { DatabaseAdapter } from "./base.ts";

type D1DatabaseLike = {
	prepare: (sql: string) => {
		bind: (...args: unknown[]) => {
			run: () => Promise<{ meta?: { last_row_id?: string | number } } | undefined>;
			first: () => Promise<Record<string, unknown> | null>;
		};
	};
};

type D1UserAdapterOptions = {
	usersTable?: string;
	oauthAccountsTable?: string;
	sanitizeUser?: (user: Record<string, unknown> | null) => Record<string, unknown> | null;
	columns?: Partial<Record<string, string>>;
	oauthColumns?: Partial<Record<string, string>>;
	allowedFields?: string[];
};

export class D1UserAdapter extends DatabaseAdapter {
	db: D1DatabaseLike;
	usersTable: string;
	oauthAccountsTable: string;
	sanitizeUser: (user: Record<string, unknown> | null) => Record<string, unknown> | null;
	columns: Record<string, string>;
	oauthColumns: Record<string, string>;
	allowedFields: string[];

	constructor(db: D1DatabaseLike, options: D1UserAdapterOptions = {}) {
		super();
		this.db = db;
		this.usersTable = options.usersTable || "users";
		this.oauthAccountsTable = options.oauthAccountsTable || "oauth_accounts";
		this.sanitizeUser = options.sanitizeUser || this._defaultSanitizeUser;
		this.columns = {
			id: options.columns?.id || "id",
			email: options.columns?.email || "email",
			name: options.columns?.name || "name",
			avatar: options.columns?.avatar || "avatar",
			emailVerified: options.columns?.emailVerified || "email_verified",
			password: options.columns?.password || "password",
		};
		this.oauthColumns = {
			userId: options.oauthColumns?.userId || "user_id",
			provider: options.oauthColumns?.provider || "provider",
			providerAccountId:
				options.oauthColumns?.providerAccountId || "provider_account_id",
		};
		this.allowedFields = options.allowedFields || [
			"email",
			"name",
			"avatar",
			"emailVerified",
			"password",
		];
	}

	_defaultSanitizeUser(user: Record<string, unknown> | null) {
		if (!user) return null;
		const { password, token, ...safeUser } = user;
		return safeUser;
	}

	async createUser(
		profile: Record<string, unknown>,
		metadata: Record<string, unknown> = {},
	) {
		const userData = {
			email: String(profile.email ?? ""),
			name: String(profile.name ?? profile.email ?? ""),
			avatar: (profile.picture as string | null | undefined) ?? null,
			emailVerified: Boolean(profile.verified_email),
			...metadata,
		};

		const sql = `INSERT INTO ${this.usersTable} (${this.columns.email}, ${this.columns.name}, ${this.columns.avatar}, ${this.columns.emailVerified}) VALUES (?, ?, ?, ?)`;
		const result = await this.db
			.prepare(sql)
			.bind(userData.email, userData.name, userData.avatar, userData.emailVerified)
			.run();
		const id = result?.meta?.last_row_id;
		return this.getUserById(id);
	}

	async getUserById(id: string | number) {
		const sql = `SELECT * FROM ${this.usersTable} WHERE ${this.columns.id} = ? LIMIT 1`;
		const row = await this.db.prepare(sql).bind(id).first();
		return this.sanitizeUser(row);
	}

	async getUserByEmail(email: string) {
		const sql = `SELECT * FROM ${this.usersTable} WHERE ${this.columns.email} = ? LIMIT 1`;
		const row = await this.db.prepare(sql).bind(email).first();
		return this.sanitizeUser(row);
	}

	async getUserByProviderId(provider: string, providerId: string) {
		const sql = `SELECT u.* FROM ${this.oauthAccountsTable} o
			JOIN ${this.usersTable} u ON o.${this.oauthColumns.userId} = u.${this.columns.id}
			WHERE o.${this.oauthColumns.provider} = ? AND o.${this.oauthColumns.providerAccountId} = ? LIMIT 1`;
		const row = await this.db.prepare(sql).bind(provider, providerId).first();
		return this.sanitizeUser(row);
	}

	async updateUser(id: string | number, data: Record<string, unknown>) {
		const fields = Object.keys(data);
		if (fields.length === 0) return this.getUserById(id);
		for (const field of fields) {
			if (!this.allowedFields.includes(field)) {
				throw new Error(`Field not allowed for update: ${field}`);
			}
		}
		const mappedFields = fields.map((f) => this.columns[f] || f);
		const setClause = mappedFields.map((f) => `${f} = ?`).join(", ");
		const values = fields.map((f) => data[f]);
		const sql = `UPDATE ${this.usersTable} SET ${setClause} WHERE ${this.columns.id} = ?`;
		await this.db.prepare(sql).bind(...values, id).run();
		return this.getUserById(id);
	}

	async deleteUser(id: string | number) {
		await this.db
			.prepare(`DELETE FROM ${this.usersTable} WHERE ${this.columns.id} = ?`)
			.bind(id)
			.run();
	}

	async linkOAuthAccount(userId: string | number, provider: string, providerAccountId: string) {
		const sql = `INSERT INTO ${this.oauthAccountsTable} (${this.oauthColumns.userId}, ${this.oauthColumns.provider}, ${this.oauthColumns.providerAccountId}) VALUES (?, ?, ?)`;
		await this.db.prepare(sql).bind(userId, provider, providerAccountId).run();
	}

	async _getUserWithPassword(email: string) {
		const sql = `SELECT * FROM ${this.usersTable} WHERE ${this.columns.email} = ? LIMIT 1`;
		const row = await this.db.prepare(sql).bind(email).first();
		return row || null;
	}
}
