import { SessionAdapter } from "./base.ts";
import { encodeBase64url } from "@oslojs/encoding";
import type { Cookies } from "@sveltejs/kit";
import type { Session, User } from "../../types/index.ts";

type D1Value = string | number | boolean | null;
type D1Row = Record<string, D1Value>;

type D1DatabaseLike = {
	prepare: (sql: string) => {
		bind: (...args: D1Value[]) => {
			run: () => Promise<unknown>;
			first: () => Promise<D1Row | null>;
			all: () => Promise<{ results?: D1Row[] }>;
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
	sanitizeUser?: (user: User | null) => User | null;
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
	private sanitizeUser: (user: User | null) => User | null;
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

	_defaultSanitizeUser(user: User | null): User | null {
		return user;
	}

	_generateSessionId(): string {
		const bytes = new Uint8Array(20);
		crypto.getRandomValues(bytes);
		return encodeBase64url(bytes);
	}

	private _coerceDbId(id: string): string | number {
		return /^\d+$/.test(id) ? Number(id) : id;
	}

	async createSession(userId: string, metadata: Record<string, unknown> = {}) {
		const sessionId = this._generateSessionId();
		const expiresAt = new Date(Date.now() + this.sessionLifetime);
		const sql = `INSERT INTO ${this.sessionsTable} (${this.columns.sessionId}, ${this.columns.userId}, ${this.columns.expiresAt}) VALUES (?, ?, ?)`;
		await this.db
			.prepare(sql)
			.bind(sessionId, this._coerceDbId(userId), expiresAt.toISOString())
			.run();
		return { id: sessionId, userId, expiresAt, ...metadata };
	}

	async validateSession(sessionId: string) {
		const sql = `SELECT s.${this.columns.sessionId} as session_id, s.${this.columns.userId} as user_id, s.${this.columns.expiresAt} as expires_at, u.*
		FROM ${this.sessionsTable} s
		JOIN ${this.usersTable} u ON s.${this.columns.userId} = u.${this.userColumns.id}
		WHERE s.${this.columns.sessionId} = ? LIMIT 1`;
		const row = await this.db.prepare(sql).bind(sessionId).first();
		if (!row) return { session: null, user: null };

		const expiresAtRaw = row.expires_at;
		if (typeof expiresAtRaw !== "string") return { session: null, user: null };
		const expiresAt = new Date(expiresAtRaw);
		if (Number.isNaN(expiresAt.getTime())) return { session: null, user: null };
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
		const userIdRaw = row.user_id;
		if (typeof userIdRaw !== "string" && typeof userIdRaw !== "number") {
			return { session: null, user: null };
		}
		return {
			session: {
				id: sessionId,
				userId: String(userIdRaw),
				expiresAt: newExpiresAt,
				fresh,
			},
			user,
		};
	}

	_mapUserRow(row: D1Row): User | null {
		const id = row[this.userColumns.id] ?? row.id;
		const email = row[this.userColumns.email] ?? row.email;
		const name = row[this.userColumns.name] ?? row.name;
		const avatar = row[this.userColumns.avatar] ?? row.avatar;
		const emailVerified =
			row[this.userColumns.emailVerified] ?? row.email_verified;
		if (typeof id !== "string" && typeof id !== "number") return null;
		if (typeof email !== "string") return null;
		if (typeof name !== "string") return null;
		if (avatar !== null && typeof avatar !== "string") return null;
		if (
			typeof emailVerified !== "boolean" &&
			emailVerified !== 0 &&
			emailVerified !== 1
		) {
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

	async invalidateSession(sessionId: string) {
		await this.db
			.prepare(`DELETE FROM ${this.sessionsTable} WHERE ${this.columns.sessionId} = ?`)
			.bind(sessionId)
			.run();
	}

	async invalidateUserSessions(userId: string) {
		await this.db
			.prepare(`DELETE FROM ${this.sessionsTable} WHERE ${this.columns.userId} = ?`)
			.bind(this._coerceDbId(userId))
			.run();
	}

	async listSessions(userId: string): Promise<Session[]> {
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
		const result = await this.db.prepare(sql).bind(this._coerceDbId(userId)).all();
		const sessions: Session[] = [];
		for (const row of result?.results ?? []) {
			const id = row[this.columns.sessionId] ?? row.id;
			const uid = row[this.columns.userId] ?? row.user_id;
			const expiresRaw =
				row[this.columns.expiresAt] ?? row.expires_at ?? row.expiresAt;
			if (
				(typeof id !== "string" && typeof id !== "number") ||
				(typeof uid !== "string" && typeof uid !== "number") ||
				typeof expiresRaw !== "string"
			) {
				continue;
			}
			const expiresAt = new Date(expiresRaw);
			if (Number.isNaN(expiresAt.getTime())) continue;
			sessions.push({
				id: String(id),
				userId: String(uid),
				expiresAt,
			});
		}
		return sessions;
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
