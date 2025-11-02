import { DatabaseAdapter } from "./base.js";
import { eq } from "drizzle-orm";

/**
 * Drizzle ORM Database Adapter
 * Implements user management using Drizzle ORM
 */
export class DrizzleUserAdapter extends DatabaseAdapter {
	/**
	 * @param {Object} db - Drizzle database instance
	 * @param {Object} options - Configuration options
	 * @param {Object} options.usersTable - Drizzle users table schema
	 * @param {Object} [options.oauthAccountsTable] - Drizzle OAuth accounts table schema
	 * @param {Function} [options.sanitizeUser] - Function to sanitize user objects
	 */
	constructor(db, options = {}) {
		super();
		this.db = db;
		this.usersTable = options.usersTable;
		this.oauthAccountsTable = options.oauthAccountsTable;
		this.sanitizeUser = options.sanitizeUser || this._defaultSanitizeUser;

		if (!this.usersTable) {
			throw new Error("DrizzleUserAdapter requires usersTable option");
		}
	}

	/**
	 * Default sanitize user function - removes sensitive fields
	 * @param {Object|null} user
	 * @returns {Object|null}
	 * @private
	 */
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

		const [user] = await this.db
			.insert(this.usersTable)
			.values(userData)
			.returning();

		return this.sanitizeUser(user);
	}

	async getUserById(id) {
		const [user] = await this.db
			.select()
			.from(this.usersTable)
			.where(eq(this.usersTable.id, id));

		return this.sanitizeUser(user);
	}

	async getUserByEmail(email) {
		const [user] = await this.db
			.select()
			.from(this.usersTable)
			.where(eq(this.usersTable.email, email));

		return this.sanitizeUser(user);
	}

	async getUserByProviderId(provider, providerId) {
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

	async updateUser(id, data) {
		const [user] = await this.db
			.update(this.usersTable)
			.set(data)
			.where(eq(this.usersTable.id, id))
			.returning();

		return this.sanitizeUser(user);
	}

	async deleteUser(id) {
		await this.db.delete(this.usersTable).where(eq(this.usersTable.id, id));
	}

	async linkOAuthAccount(userId, provider, providerAccountId) {
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
	async _getUserWithPassword(email) {
		const [user] = await this.db
			.select()
			.from(this.usersTable)
			.where(eq(this.usersTable.email, email));

		return user || null;
	}
}
