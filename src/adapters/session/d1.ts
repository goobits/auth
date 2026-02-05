// @ts-nocheck
import { SessionAdapter } from "./base.ts";
import { encodeBase64url } from "@oslojs/encoding";
import type { Cookies } from "@sveltejs/kit";

type D1DatabaseLike = {
	prepare: (sql: string) => {
		bind: (...args: unknown[]) => {
			run: () => Promise<unknown>;
			first: () => Promise<Record<string, unknown> | null>;
			all: () => Promise<{ results?: Record<string, unknown>[] }>;
		};
	};
};

type D1SessionOptions = {
	sessionsTable?: string;
	usersTable?: string;
	sessionLifetime?: number;
	sessionRefreshThreshold?: number;
	cookieName?: string;
	secureCookies?: boolean;
	sanitizeUser?: (user: Record<string, unknown> | null) => Record<string, unknown> | null;
	columns?: Partial<{
		sessionId: string;
		userId: string;
		expiresAt: string;
		createdAt: string | null;
		lastActiveAt: string | null;
		ip: string | null;
		userAgent: string | null;
	}>;
	userColumns?: Partial<{
		id: string;
		email: string;
		name: string;
		avatar: string;
		password: string;
		emailVerified: string;
	}>;
};

export class D1SessionAdapter extends SessionAdapter {
	private db: D1DatabaseLike;
	private sessionsTable: string;
	private usersTable: string;
	private sessionLifetime: number;
	private sessionRefreshThreshold: number;
	private cookieName: string;
	private secureCookies: boolean;
	private sanitizeUser: (user: Record<string, unknown> | null) => Record<string, unknown> | null;
	private columns: {
		sessionId: string;
		userId: string;
		expiresAt: string;
		createdAt: string | null;
		lastActiveAt: string | null;
		ip: string | null;
		userAgent: string | null;
	};
	private userColumns: {
		id: string;
		email: string;
		name: string;
		avatar: string;
		password: string;
		emailVerified: string;
	};

	constructor(db: D1DatabaseLike, options: D1SessionOptions = {}) {
		super();
		this.db = db;
		this.sessionsTable = options.sessionsTable || "sessions";
		this.usersTable = options.usersTable || "users";
		this.sessionLifetime = options.sessionLifetime || 30 * 24 * 60 * 60 * 1000;
		this.sessionRefreshThreshold =
			options.sessionRefreshThreshold || this.sessionLifetime / 2;
		this.cookieName = options.cookieName || "session";
		this.secureCookies = options.secureCookies !== false;
		this.sanitizeUser = options.sanitizeUser || this._defaultSanitizeUser;
		this.columns = {
			sessionId: options.columns?.sessionId || "id",
			userId: options.columns?.userId || "user_id",
			expiresAt: options.columns?.expiresAt || "expires_at",
			createdAt: options.columns?.createdAt || null,
			lastActiveAt: options.columns?.lastActiveAt || null,
			ip: options.columns?.ip || null,
			userAgent: options.columns?.userAgent || null,
		};
		this.userColumns = {
			id: options.userColumns?.id || "id",
			email: options.userColumns?.email || "email",
			name: options.userColumns?.name || "name",
			avatar: options.userColumns?.avatar || "avatar",
			password: options.userColumns?.password || "password",
			emailVerified: options.userColumns?.emailVerified || "email_verified",
		};
	}

	_defaultSanitizeUser(user: Record<string, unknown> | null) {
		if (!user) return null;
		const { password, token, ...safeUser } = user;
		return safeUser;
	}

	_generateSessionId(): string {
		const bytes = new Uint8Array(20);
		crypto.getRandomValues(bytes);
		return encodeBase64url(bytes);
	}

	async createSession(userId: string, metadata: Record<string, unknown> = {}) {
		const sessionId = this._generateSessionId();
		const expiresAt = new Date(Date.now() + this.sessionLifetime);
		const sql = `INSERT INTO ${this.sessionsTable} (${this.columns.sessionId}, ${this.columns.userId}, ${this.columns.expiresAt}) VALUES (?, ?, ?)`;
		await this.db.prepare(sql).bind(sessionId, userId, expiresAt.toISOString()).run();
		return { id: sessionId, userId, expiresAt, ...metadata };
	}

	async validateSession(sessionId: string) {
		const sql = `SELECT s.${this.columns.sessionId} as session_id, s.${this.columns.userId} as user_id, s.${this.columns.expiresAt} as expires_at, u.*
		FROM ${this.sessionsTable} s
		JOIN ${this.usersTable} u ON s.${this.columns.userId} = u.${this.userColumns.id}
		WHERE s.${this.columns.sessionId} = ? LIMIT 1`;
		const row = await this.db.prepare(sql).bind(sessionId).first();
		if (!row) return { session: null, user: null };

		const expiresAt = new Date(row.expires_at);
		if (Date.now() >= expiresAt.getTime()) {
			await this.db
				.prepare(`DELETE FROM ${this.sessionsTable} WHERE ${this.columns.sessionId} = ?`)
				.bind(sessionId)
				.run();
			return { session: null, user: null };
		}

		const shouldRefresh =
			Date.now() >= expiresAt.getTime() - this.sessionRefreshThreshold;
		let fresh = false;
		let newExpiresAt = expiresAt;

		if (shouldRefresh) {
			newExpiresAt = new Date(Date.now() + this.sessionLifetime);
			await this.db
				.prepare(
					`UPDATE ${this.sessionsTable} SET ${this.columns.expiresAt} = ? WHERE ${this.columns.sessionId} = ?`,
				)
				.bind(newExpiresAt.toISOString(), sessionId)
				.run();
			fresh = true;
		}

		const user = this.sanitizeUser(this._mapUserRow(row));
		return {
			session: { id: sessionId, userId: row.user_id, expiresAt: newExpiresAt, fresh },
			user,
		};
	}

	_mapUserRow(row: Record<string, unknown>) {
		return {
			id: (row as Record<string, unknown>)[this.userColumns.id] ?? (row as Record<string, unknown>).id,
			email: (row as Record<string, unknown>)[this.userColumns.email] ?? (row as Record<string, unknown>).email,
			name: (row as Record<string, unknown>)[this.userColumns.name] ?? (row as Record<string, unknown>).name,
			avatar: (row as Record<string, unknown>)[this.userColumns.avatar] ?? (row as Record<string, unknown>).avatar,
			password: (row as Record<string, unknown>)[this.userColumns.password] ?? (row as Record<string, unknown>).password,
			emailVerified:
				(row as Record<string, unknown>)[this.userColumns.emailVerified] ??
				(row as Record<string, unknown>).email_verified,
		};
	}

	async invalidateSession(sessionId: string) {
		await this.db
			.prepare(`DELETE FROM ${this.sessionsTable} WHERE ${this.columns.sessionId} = ?`)
			.bind(sessionId)
			.run();
	}

	async invalidateUserSessions(userId: string) {
		await this.db
			.prepare(`DELETE FROM ${this.sessionsTable} WHERE ${this.columns.userId} = ?`)
			.bind(userId)
			.run();
	}

	async listSessions(userId: string) {
		const columns = [
			this.columns.sessionId,
			this.columns.userId,
			this.columns.expiresAt,
			this.columns.createdAt,
			this.columns.lastActiveAt,
			this.columns.ip,
			this.columns.userAgent,
		];
		const unique = [...new Set(columns.filter(Boolean))];
		const sql = `SELECT ${unique.join(", ")} FROM ${this.sessionsTable} WHERE ${this.columns.userId} = ?`;
		const result = await this.db.prepare(sql).bind(userId).all();
		return (result?.results ?? []).map((row: Record<string, unknown>) => ({
			id: row[this.columns.sessionId] ?? row.id,
			userId: row[this.columns.userId] ?? row.user_id,
			expiresAt: new Date(
				row[this.columns.expiresAt] ?? row.expires_at ?? row.expiresAt,
			),
			createdAt: this.columns.createdAt
				? row[this.columns.createdAt] ?? null
				: null,
			lastActiveAt: this.columns.lastActiveAt
				? row[this.columns.lastActiveAt] ?? null
				: null,
			ip: this.columns.ip ? row[this.columns.ip] ?? null : null,
			userAgent: this.columns.userAgent
				? row[this.columns.userAgent] ?? null
				: null,
		}));
	}

	setSessionCookie(cookies: Cookies, session: { id: string; expiresAt: Date }) {
		cookies.set(this.cookieName, session.id, {
			httpOnly: true,
			secure: this.secureCookies,
			sameSite: "lax",
			path: "/",
			expires: session.expiresAt,
		});
	}

	deleteSessionCookie(cookies: Cookies) {
		cookies.delete(this.cookieName, {
			path: "/",
		});
	}
}
