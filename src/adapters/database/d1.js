import { DatabaseAdapter } from "./base.js";

export class D1UserAdapter extends DatabaseAdapter {
	constructor(db, options = {}) {
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
	}

	_defaultSanitizeUser(user) {
		if (!user) return null;
		const { password, token, ...safeUser } = user;
		return safeUser;
	}

	async createUser(profile, metadata = {}) {
		const userData = {
			email: profile.email,
			name: profile.name || profile.email,
			avatar: profile.picture || null,
			emailVerified: profile.verified_email || false,
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

	async getUserById(id) {
		const sql = `SELECT * FROM ${this.usersTable} WHERE ${this.columns.id} = ? LIMIT 1`;
		const row = await this.db.prepare(sql).bind(id).first();
		return this.sanitizeUser(row);
	}

	async getUserByEmail(email) {
		const sql = `SELECT * FROM ${this.usersTable} WHERE ${this.columns.email} = ? LIMIT 1`;
		const row = await this.db.prepare(sql).bind(email).first();
		return this.sanitizeUser(row);
	}

	async getUserByProviderId(provider, providerId) {
		const sql = `SELECT u.* FROM ${this.oauthAccountsTable} o
			JOIN ${this.usersTable} u ON o.${this.oauthColumns.userId} = u.${this.columns.id}
			WHERE o.${this.oauthColumns.provider} = ? AND o.${this.oauthColumns.providerAccountId} = ? LIMIT 1`;
		const row = await this.db.prepare(sql).bind(provider, providerId).first();
		return this.sanitizeUser(row);
	}

	async updateUser(id, data) {
		const fields = Object.keys(data);
		if (fields.length === 0) return this.getUserById(id);
		const setClause = fields.map((f) => `${f} = ?`).join(", ");
		const values = fields.map((f) => data[f]);
		const sql = `UPDATE ${this.usersTable} SET ${setClause} WHERE ${this.columns.id} = ?`;
		await this.db.prepare(sql).bind(...values, id).run();
		return this.getUserById(id);
	}

	async deleteUser(id) {
		await this.db
			.prepare(`DELETE FROM ${this.usersTable} WHERE ${this.columns.id} = ?`)
			.bind(id)
			.run();
	}

	async linkOAuthAccount(userId, provider, providerAccountId) {
		const sql = `INSERT INTO ${this.oauthAccountsTable} (${this.oauthColumns.userId}, ${this.oauthColumns.provider}, ${this.oauthColumns.providerAccountId}) VALUES (?, ?, ?)`;
		await this.db.prepare(sql).bind(userId, provider, providerAccountId).run();
	}

	async _getUserWithPassword(email) {
		const sql = `SELECT * FROM ${this.usersTable} WHERE ${this.columns.email} = ? LIMIT 1`;
		const row = await this.db.prepare(sql).bind(email).first();
		return row || null;
	}
}
