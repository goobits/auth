import { UserAdapter } from "./base.js";
import type { User } from "../../types/index.js";

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
		role: string;
		settings: string;
		createdAt: string;
		updatedAt: string;
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
			role: options.columns?.["role"] || "role",
			settings: options.columns?.["settings"] || "settings",
			createdAt: options.columns?.["createdAt"] || "created_at",
			updatedAt: options.columns?.["updatedAt"] || "updated_at",
		};
		this.oauthColumns = {
			userId: options.oauthColumns?.["userId"] || "user_id",
			provider: options.oauthColumns?.["provider"] || "provider",
			providerAccountId:
				options.oauthColumns?.["providerAccountId"] || "provider_account_id",
		};
		this.allowedFields =
			options.allowedFields || [
				"email",
				"name",
				"avatar",
				"emailVerified",
				"password",
				"role",
				"settings",
				"createdAt",
				"updatedAt",
			];
	}

	private mapUser(row: D1Row | null): User | null {
		if (!row) return null;
		const rawId = row[this.columns["id"]] ?? row["id"];
		const email = row[this.columns["email"]] ?? row["email"];
		const rawName = row[this.columns["name"]] ?? row["name"];
		const rawAvatar = row[this.columns["avatar"]] ?? row["avatar"];
		const rawEmailVerified = row[this.columns.emailVerified] ?? row["email_verified"];
		const rawRole = row[this.columns.role] ?? row["role"];
		const rawSettings = row[this.columns.settings] ?? row["settings"];
		const rawCreatedAt = row[this.columns.createdAt] ?? row["created_at"];
		const rawUpdatedAt = row[this.columns.updatedAt] ?? row["updated_at"];

		if (rawId === null || rawId === undefined) return null;
		if (typeof email !== "string") return null;

		// Normalize data from SQLite/D1 which may represent values as numbers/strings.
		const id =
			typeof rawId === "string" || typeof rawId === "number"
				? String(rawId)
				: null;
		if (!id) return null;

		const name = typeof rawName === "string" ? rawName : email;
		const avatar = typeof rawAvatar === "string" ? rawAvatar : null;
		let emailVerified = false;
		if (typeof rawEmailVerified === "boolean") emailVerified = rawEmailVerified;
		else if (rawEmailVerified === 0 || rawEmailVerified === 1) emailVerified = Boolean(rawEmailVerified);
		else if (rawEmailVerified === "0" || rawEmailVerified === "1") emailVerified = rawEmailVerified === "1";

		const role = typeof rawRole === "string" ? rawRole : undefined;

		let parsedSettings: Record<string, unknown> | undefined;
		if (typeof rawSettings === "string" && rawSettings.trim().length > 0) {
			try {
				const decoded: unknown = JSON.parse(rawSettings);
				if (decoded && typeof decoded === "object" && !Array.isArray(decoded)) {
					parsedSettings = decoded as Record<string, unknown>;
				}
			} catch {
				// Ignore invalid JSON; caller can repair by overwriting settings.
			}
		}

		const createdAt =
			typeof rawCreatedAt === "string" && !Number.isNaN(new Date(rawCreatedAt).getTime())
				? new Date(rawCreatedAt)
				: undefined;
		const updatedAt =
			typeof rawUpdatedAt === "string" && !Number.isNaN(new Date(rawUpdatedAt).getTime())
				? new Date(rawUpdatedAt)
				: undefined;

		return {
			id,
			email,
			name,
			avatar,
			emailVerified,
			...(role ? { role } : {}),
			...(parsedSettings ? { settings: parsedSettings } : {}),
			...(createdAt ? { createdAt } : {}),
			...(updatedAt ? { updatedAt } : {}),
		};
	}

	_defaultSanitizeUser(user: User | null): User | null {
		return user;
	}

	private mapFieldToColumn(field: string): string {
		if (field === "id") return this.columns.id;
		if (field === "email") return this.columns.email;
		if (field === "name") return this.columns.name;
		if (field === "avatar") return this.columns.avatar;
		if (field === "emailVerified") return this.columns.emailVerified;
		if (field === "password") return this.columns.password;
		if (field === "role") return this.columns.role;
		if (field === "settings") return this.columns.settings;
		if (field === "createdAt") return this.columns.createdAt;
		if (field === "updatedAt") return this.columns.updatedAt;
		return field;
	}

	private toD1Value(value: unknown): D1Value {
		if (value === null || value === undefined) return null;
		if (typeof value === "boolean") return value ? 1 : 0;
		if (typeof value === "string" || typeof value === "number") return value;
		// Support structured settings by storing JSON in a text column.
		if (value && typeof value === "object") {
			try {
				return JSON.stringify(value);
			} catch {
				return String(value);
			}
		}
		return String(value);
	}

		async createUser(
			profile: { email: string; name?: string; picture?: string; verified_email?: boolean },
			metadata: Record<string, unknown> = {},
		): Promise<User> {
			const normalizedEmail = profile.email.trim().toLowerCase();
			const userData: Record<string, unknown> = {
				email: normalizedEmail,
				name: profile.name ?? normalizedEmail,
				avatar: profile.picture ?? null,
				emailVerified: Boolean(profile.verified_email),
			};

		// Persist only fields that are explicitly allowed (including password hash).
		for (const [key, value] of Object.entries(metadata)) {
			if (!this.allowedFields.includes(key)) continue;
			userData[key] = value;
		}

		const fields = Object.keys(userData);
		const columns = fields.map((field) => this.mapFieldToColumn(field));
		const placeholders = fields.map(() => "?").join(", ");
		const values = fields.map((field) => this.toD1Value(userData[field]));

		const sql = `INSERT INTO ${this.usersTable} (${columns.join(", ")}) VALUES (${placeholders})`;
		const result = await this.db.prepare(sql).bind(...values).run();

		// Prefer looking up by email (works even when table IDs aren't rowid-backed).
			const createdByEmail = await this.getUserByEmail(normalizedEmail);
		if (createdByEmail) return createdByEmail;

		// Fallback for environments where email is not unique.
		const id = result?.meta?.last_row_id;
		if (id !== undefined) {
			const created = await this.getUserById(String(id), id);
			if (created) return created;
		}

		throw new Error("Created user not found");
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
			const sql = `SELECT * FROM ${this.usersTable} WHERE lower(${this.columns.email}) = lower(?) ORDER BY ${this.columns.id} ASC LIMIT 1`;
			const row = await this.db.prepare(sql).bind(email.trim()).first();
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
		const mappedFields = fields.map((field) => this.mapFieldToColumn(field));
		const setClause = mappedFields.map((f) => `${f} = ?`).join(", ");
		const values = fields.map((field) => this.toD1Value(data[field]));
		const sql = `UPDATE ${this.usersTable} SET ${setClause} WHERE ${this.columns.id} = ?`;
		await this.db
			.prepare(sql)
			.bind(
				...values,
				this.toD1Value(id),
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
			const sql = `SELECT * FROM ${this.usersTable} WHERE lower(${this.columns.email}) = lower(?) ORDER BY ${this.columns.id} ASC LIMIT 1`;
			const row = await this.db.prepare(sql).bind(email.trim()).first();
		const mapped = this.mapUser(row);
		if (!mapped) return null;
		const password = row?.[this.columns["password"]] ?? row?.["password"];
		return {
			...mapped,
			password: typeof password === "string" ? password : null,
		};
	}
}
