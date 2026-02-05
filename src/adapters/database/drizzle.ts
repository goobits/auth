import { DatabaseAdapter } from "./base.ts";
import { eq } from "drizzle-orm";

/**
 * Drizzle ORM Database Adapter
 * Implements user management using Drizzle ORM
 */
export class DrizzleUserAdapter extends DatabaseAdapter {
	private db: unknown;
	private usersTable: Record<string, unknown>;
	private oauthAccountsTable?: Record<string, unknown>;
	private sanitizeUser: (user: Record<string, unknown> | null) => Record<string, unknown> | null;
	/**
	 * @param {Object} db - Drizzle database instance
	 * @param {Object} options - Configuration options
	 * @param {Object} options.usersTable - Drizzle users table schema
	 * @param {Object} [options.oauthAccountsTable] - Drizzle OAuth accounts table schema
	 * @param {Function} [options.sanitizeUser] - Function to sanitize user objects
	 */
	constructor(
		db: unknown,
		options: {
			usersTable?: Record<string, unknown>;
			oauthAccountsTable?: Record<string, unknown>;
			sanitizeUser?: (user: Record<string, unknown> | null) => Record<string, unknown> | null;
		} = {},
	) {
		super();
		this.db = db;
		this.usersTable = options.usersTable ?? {};
		this.oauthAccountsTable = options.oauthAccountsTable;
		this.sanitizeUser = options.sanitizeUser || this._defaultSanitizeUser;

		if (!options.usersTable) {
			throw new Error("DrizzleUserAdapter requires usersTable option");
		}
	}

	/**
	 * Default sanitize user function - removes sensitive fields
	 * @param {Object|null} user
	 * @returns {Object|null}
	 * @private
	 */
	_defaultSanitizeUser(user: Record<string, unknown> | null) {
		if (!user) return null;
		const { password, token, ...safeUser } = user;
		return safeUser;
	}

	async createUser(profile: Record<string, unknown>, metadata: Record<string, unknown> = {}) {
		const userData = {
			email: String(profile.email ?? ""),
			name: String(profile.name ?? profile.email ?? ""),
			avatar: (profile.picture as string | null | undefined) ?? null,
			emailVerified: Boolean(profile.verified_email),
			...metadata,
		};

		const [user] = await this.db
			.insert(this.usersTable)
			.values(userData)
			.returning();

		return this.sanitizeUser(user);
	}

	async getUserById(id: string) {
		const [user] = await this.db
			.select()
			.from(this.usersTable)
			.where(eq(this.usersTable.id, id));

		return this.sanitizeUser(user);
	}

	async getUserByEmail(email: string) {
		const [user] = await this.db
			.select()
			.from(this.usersTable)
			.where(eq(this.usersTable.email, email));

		return this.sanitizeUser(user);
	}

	async getUserByProviderId(provider: string, providerId: string) {
		if (!this.oauthAccountsTable) {
			throw new Error(
				"OAuth accounts table not configured. Set oauthAccountsTable in adapter options.",
			);
		}

		const [result] = await this.db
			.select({ user: this.usersTable })
			.from(this.oauthAccountsTable)
			.innerJoin(
				this.usersTable,
				eq(this.oauthAccountsTable.userId, this.usersTable.id),
			)
			.where(
				eq(this.oauthAccountsTable.provider, provider),
				eq(this.oauthAccountsTable.providerAccountId, providerId),
			);

		return this.sanitizeUser(result?.user);
	}

	async updateUser(id: string, data: Record<string, unknown>) {
		const [user] = await this.db
			.update(this.usersTable)
			.set(data)
			.where(eq(this.usersTable.id, id))
			.returning();

		return this.sanitizeUser(user);
	}

	async deleteUser(id: string) {
		await this.db.delete(this.usersTable).where(eq(this.usersTable.id, id));
	}

	async linkOAuthAccount(
		userId: string,
		provider: string,
		providerAccountId: string,
	) {
		if (!this.oauthAccountsTable) {
			throw new Error(
				"OAuth accounts table not configured. Set oauthAccountsTable in adapter options.",
			);
		}

		await this.db.insert(this.oauthAccountsTable).values({
			userId,
			provider,
			providerAccountId,
		});
	}

	/**
	 * INTERNAL: Get user with password for authentication
	 * @param {string} email
	 * @returns {Promise<Object|null>}
	 * @private
	 */
	async _getUserWithPassword(email: string) {
		const [user] = await this.db
			.select()
			.from(this.usersTable)
			.where(eq(this.usersTable.email, email));

		return user || null;
	}
}
