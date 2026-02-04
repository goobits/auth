import { SessionAdapter } from "./base.js";
import { encodeBase64url } from "@oslojs/encoding";
import { eq } from "drizzle-orm";

/**
 * Drizzle ORM Session Adapter
 * Implements session management using Drizzle ORM with PostgreSQL
 */
export class DrizzleSessionAdapter extends SessionAdapter {
	/**
	 * @param {Object} db - Drizzle database instance
	 * @param {Object} options - Configuration options
	 * @param {Object} options.sessionsTable - Drizzle sessions table schema
	 * @param {Object} options.usersTable - Drizzle users table schema
	 * @param {number} [options.sessionLifetime=2592000000] - Session lifetime in ms (default: 30 days)
	 * @param {number} [options.sessionRefreshThreshold=1296000000] - Refresh threshold in ms (default: 15 days)
	 * @param {string} [options.cookieName='session'] - Session cookie name
	 * @param {boolean} [options.secureCookies=true] - Use secure cookies
	 * @param {Function} [options.sanitizeUser] - Function to sanitize user objects
	 */
	constructor(db, options = {}) {
		super();
		this.db = db;
		this.sessionsTable = options.sessionsTable;
		this.usersTable = options.usersTable;
		this.sessionLifetime = options.sessionLifetime || 30 * 24 * 60 * 60 * 1000; // 30 days
		this.sessionRefreshThreshold =
			options.sessionRefreshThreshold || this.sessionLifetime / 2; // 15 days
		this.cookieName = options.cookieName || "session";
		this.secureCookies = options.secureCookies !== false;
		this.sanitizeUser = options.sanitizeUser || this._defaultSanitizeUser;

		if (!this.sessionsTable || !this.usersTable) {
			throw new Error(
				"DrizzleSessionAdapter requires sessionsTable and usersTable options",
			);
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

	/**
	 * Generate cryptographically secure session ID
	 * @returns {string}
	 * @private
	 */
	_generateSessionId() {
		const bytes = new Uint8Array(20);
		crypto.getRandomValues(bytes);
		return encodeBase64url(bytes);
	}

	async createSession(userId, metadata = {}) {
		const sessionId = this._generateSessionId();
		const expiresAt = new Date(Date.now() + this.sessionLifetime);

		await this.db.insert(this.sessionsTable).values({
			id: sessionId,
			userId,
			expiresAt,
			...metadata,
		});

		return { id: sessionId, userId, expiresAt, ...metadata };
	}

	async validateSession(sessionId) {
		const [result] = await this.db
			.select({ user: this.usersTable, session: this.sessionsTable })
			.from(this.sessionsTable)
			.innerJoin(this.usersTable, eq(this.sessionsTable.userId, this.usersTable.id))
			.where(eq(this.sessionsTable.id, sessionId));

		if (!result) {
			return { session: null, user: null };
		}

		const { session, user } = result;

		// Check if expired
		if (Date.now() >= session.expiresAt.getTime()) {
			await this.db
				.delete(this.sessionsTable)
				.where(eq(this.sessionsTable.id, sessionId));
			return { session: null, user: null };
		}

		// Extend session if less than threshold remaining
		const shouldRefresh =
			Date.now() >= session.expiresAt.getTime() - this.sessionRefreshThreshold;

		if (shouldRefresh) {
			session.expiresAt = new Date(Date.now() + this.sessionLifetime);
			await this.db
				.update(this.sessionsTable)
				.set({ expiresAt: session.expiresAt })
				.where(eq(this.sessionsTable.id, sessionId));

			// Mark session as fresh for cookie update
			session.fresh = true;
		}

		return { session, user: this.sanitizeUser(user) };
	}

	async invalidateSession(sessionId) {
		await this.db
			.delete(this.sessionsTable)
			.where(eq(this.sessionsTable.id, sessionId));
	}

	async invalidateUserSessions(userId) {
		await this.db
			.delete(this.sessionsTable)
			.where(eq(this.sessionsTable.userId, userId));
	}

	async listSessions(userId) {
		const selectFields = {
			id: this.sessionsTable.id,
			userId: this.sessionsTable.userId,
			expiresAt: this.sessionsTable.expiresAt,
		};

		if (this.sessionsTable.createdAt) {
			selectFields.createdAt = this.sessionsTable.createdAt;
		}
		if (this.sessionsTable.lastActiveAt) {
			selectFields.lastActiveAt = this.sessionsTable.lastActiveAt;
		}
		if (this.sessionsTable.ip) {
			selectFields.ip = this.sessionsTable.ip;
		}
		if (this.sessionsTable.userAgent) {
			selectFields.userAgent = this.sessionsTable.userAgent;
		}

		return this.db
			.select(selectFields)
			.from(this.sessionsTable)
			.where(eq(this.sessionsTable.userId, userId));
	}

	setSessionCookie(cookies, session) {
		cookies.set(this.cookieName, session.id, {
			httpOnly: true,
			secure: this.secureCookies,
			sameSite: "lax",
			path: "/",
			expires: session.expiresAt,
		});
	}

	deleteSessionCookie(cookies) {
		cookies.delete(this.cookieName, {
			path: "/",
		});
	}
}
