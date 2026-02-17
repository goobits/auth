import { SessionAdapter } from "./base.js";
import { encodeBase64url } from "@oslojs/encoding";
import type { Cookies } from "@sveltejs/kit";
import type { Session, User } from "../../types/index.js";

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
		role: string;
		settings: string;
		createdAt: string;
		updatedAt: string;
	}>;
};

export class D1SessionAdapter extends SessionAdapter {
	private db: D1DatabaseLike;
	private sessionsTable: string;
	private usersTable: string;
	private sessionLifetime: number;
	private sessionRefreshThreshold: number;
	// Exposed for auth hook resolution (`createAuth` reads adapter.cookieName).
	cookieName: string;
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
		role: string;
		settings: string;
		createdAt: string;
		updatedAt: string;
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
			role: options.userColumns?.role || "role",
			settings: options.userColumns?.settings || "settings",
			createdAt: options.userColumns?.createdAt || "created_at",
			updatedAt: options.userColumns?.updatedAt || "updated_at",
		};
	}

	_defaultSanitizeUser(user: User | null): User | null {
		return user;
	}

	_generateSessionId(): string {
		const bytes = new Uint8Array(20);
		crypto.getRandomValues(bytes);
		// Cookie values are not reliably percent-decoded by all runtimes. Avoid '=' padding
		// so we never emit values that need encoding like `%3D`.
		return encodeBase64url(bytes).replace(/=+$/g, "");
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

		const expiresAtRaw = row["expires_at"];
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
		const userIdRaw = row["user_id"];
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
		const id = row[this.userColumns["id"]] ?? row["id"];
		const email = row[this.userColumns["email"]] ?? row["email"];
		const name = row[this.userColumns["name"]] ?? row["name"];
		// Preserve explicit NULLs from the DB (e.g. avatar_url = null).
		// Using `??` would treat `null` as "missing" and fall back to undefined, failing validation.
		const avatar = Object.prototype.hasOwnProperty.call(row, this.userColumns["avatar"])
			? row[this.userColumns["avatar"]]
			: row["avatar"];
		const emailVerified =
			row[this.userColumns.emailVerified] ?? row["email_verified"];
		const role = row[this.userColumns.role] ?? row["role"];
		const settings = row[this.userColumns.settings] ?? row["settings"];
		const createdAt = row[this.userColumns.createdAt] ?? row["created_at"];
		const updatedAt = row[this.userColumns.updatedAt] ?? row["updated_at"];
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
		if (role !== null && role !== undefined && typeof role !== "string") return null;
		if (settings !== null && settings !== undefined && typeof settings !== "string") return null;
			if (
				createdAt !== null &&
				createdAt !== undefined &&
				typeof createdAt !== "string" &&
				typeof createdAt !== "number"
			) {
				return null;
			}
			if (
				updatedAt !== null &&
				updatedAt !== undefined &&
				typeof updatedAt !== "string" &&
				typeof updatedAt !== "number"
			) {
				return null;
			}

		let parsedSettings: Record<string, unknown> | undefined;
		if (typeof settings === "string" && settings.trim().length > 0) {
			try {
				const decoded: unknown = JSON.parse(settings);
				if (decoded && typeof decoded === "object" && !Array.isArray(decoded)) {
					parsedSettings = decoded as Record<string, unknown>;
				}
			} catch {
				// Ignore invalid JSON.
			}
		}
			const createdAtDate = (() => {
				if (typeof createdAt === "string") {
					const parsed = new Date(createdAt);
					return Number.isNaN(parsed.getTime()) ? undefined : parsed;
				}
				if (typeof createdAt === "number") {
					// sqlite `unixepoch()` defaults are seconds; accept ms too.
					const ms = createdAt > 1e12 ? createdAt : createdAt * 1000;
					const parsed = new Date(ms);
					return Number.isNaN(parsed.getTime()) ? undefined : parsed;
				}
				return undefined;
			})();
			const updatedAtDate = (() => {
				if (typeof updatedAt === "string") {
					const parsed = new Date(updatedAt);
					return Number.isNaN(parsed.getTime()) ? undefined : parsed;
				}
				if (typeof updatedAt === "number") {
					const ms = updatedAt > 1e12 ? updatedAt : updatedAt * 1000;
					const parsed = new Date(ms);
					return Number.isNaN(parsed.getTime()) ? undefined : parsed;
				}
				return undefined;
			})();
		return {
			id: String(id),
			email,
			name,
			avatar,
			emailVerified: Boolean(emailVerified),
			...(typeof role === "string" ? { role } : {}),
			...(parsedSettings ? { settings: parsedSettings } : {}),
			...(createdAtDate ? { createdAt: createdAtDate } : {}),
			...(updatedAtDate ? { updatedAt: updatedAtDate } : {}),
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
			const id = row[this.columns.sessionId] ?? row["id"];
			const uid = row[this.columns.userId] ?? row["user_id"];
			const expiresRaw =
				row[this.columns["expiresAt"]] ?? row["expires_at"] ?? row["expiresAt"];
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
