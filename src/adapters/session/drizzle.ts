import { SessionAdapter } from "./base.js";
import { encodeBase64url } from "@oslojs/encoding";
import { eq } from "drizzle-orm";
import type { Cookies } from "@sveltejs/kit";
import type { Session, User } from "../../types/index.js";
import type { DrizzleDbLike, DrizzleJson, DrizzleRow, DrizzleTable } from "../drizzle-types.js";

type SessionsTable = DrizzleTable & {
	id: DrizzleTable[string];
	userId: DrizzleTable[string];
	expiresAt: DrizzleTable[string];
	createdAt?: DrizzleTable[string];
	lastActiveAt?: DrizzleTable[string];
	ip?: DrizzleTable[string];
	userAgent?: DrizzleTable[string];
};

type UsersTable = DrizzleTable & {
	id: DrizzleTable[string];
	email: DrizzleTable[string];
	name: DrizzleTable[string];
	avatar?: DrizzleTable[string];
	emailVerified?: DrizzleTable[string];
};

function toUser(row: DrizzleRow | null): User | null {
	if (!row) return null;
	const id = row["id"];
	const email = row["email"];
	const name = row["name"];
	const avatar = row["avatar"] ?? null;
	const emailVerified = row["emailVerified"] ?? row["email_verified"] ?? false;
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

function toSession(row: DrizzleRow | null): Session | null {
	if (!row) return null;
	const id = row["id"];
	const userId = row["userId"] ?? row["user_id"];
	const expiresAt = row["expiresAt"] ?? row["expires_at"];
	if (typeof id !== "string") return null;
	if (typeof userId !== "string" && typeof userId !== "number") return null;
	if (!(expiresAt instanceof Date) && typeof expiresAt !== "string") return null;
	const expiresDate = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
	if (Number.isNaN(expiresDate.getTime())) return null;
	return {
		id,
		userId: String(userId),
		expiresAt: expiresDate,
	};
}

function pickSessionMetadata(metadata: Record<string, DrizzleJson>): DrizzleRow {
	const values: DrizzleRow = {};
	for (const [key, value] of Object.entries(metadata)) {
		values[key] = value;
	}
	return values;
}

export class DrizzleSessionAdapter extends SessionAdapter {
	private db: DrizzleDbLike;
	private sessionsTable: SessionsTable;
	private usersTable: UsersTable;
	private sessionLifetime: number;
	private sessionRefreshThreshold: number;
	// Exposed for auth hook resolution (`createAuth` reads adapter.cookieName).
	cookieName: string;
	private secureCookies: boolean;
	private sanitizeUser: (user: User | null) => User | null;

	constructor(
		db: DrizzleDbLike,
		options: {
			sessionsTable?: SessionsTable;
			usersTable?: UsersTable;
			sessionLifetime?: number;
			sessionRefreshThreshold?: number;
			cookieName?: string;
			secureCookies?: boolean;
			sanitizeUser?: (user: User | null) => User | null;
		} = {},
	) {
		super();
		if (!options.sessionsTable || !options.usersTable) {
			throw new Error(
				"DrizzleSessionAdapter requires sessionsTable and usersTable options",
			);
		}
		this.db = db;
		this.sessionsTable = options.sessionsTable;
		this.usersTable = options.usersTable;
		this.sessionLifetime = options.sessionLifetime || 30 * 24 * 60 * 60 * 1000;
		this.sessionRefreshThreshold =
			options.sessionRefreshThreshold || this.sessionLifetime / 2;
		this.cookieName = options.cookieName || "session";
		this.secureCookies = options.secureCookies !== false;
		this.sanitizeUser = options.sanitizeUser || this._defaultSanitizeUser;
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

	async createSession(
		userId: string,
		metadata: Record<string, DrizzleJson> = {},
	): Promise<Session> {
		const sessionId = this._generateSessionId();
		const expiresAt = new Date(Date.now() + this.sessionLifetime);
		await this.db.insert(this.sessionsTable).values({
			id: sessionId,
			userId,
			expiresAt,
			...pickSessionMetadata(metadata),
		});
		return { id: sessionId, userId, expiresAt };
	}

	async validateSession(sessionId: string): Promise<{ session: Session | null; user: User | null }> {
		const [result] = await this.db
			.select({
				user: this.usersTable,
				session: this.sessionsTable,
			})
			.from(this.sessionsTable)
			.innerJoin(this.usersTable, eq(this.sessionsTable.userId, this.usersTable.id))
			.where(eq(this.sessionsTable.id, sessionId));

		if (!result) return { session: null, user: null };
		const session = toSession(result["session"] ?? null);
		if (!session) return { session: null, user: null };
		if (Date.now() >= session.expiresAt.getTime()) {
			await this.db
				.delete(this.sessionsTable)
				.where(eq(this.sessionsTable.id, sessionId));
			return { session: null, user: null };
		}
		const shouldRefresh =
			Date.now() >= session.expiresAt.getTime() - this.sessionRefreshThreshold;
		if (shouldRefresh) {
			session.expiresAt = new Date(Date.now() + this.sessionLifetime);
			session.fresh = true;
			await this.db
				.update(this.sessionsTable)
				.set({ expiresAt: session.expiresAt })
				.where(eq(this.sessionsTable.id, sessionId));
		}
		return {
			session,
			user: this.sanitizeUser(toUser(result["user"] ?? null)),
		};
	}

	async invalidateSession(sessionId: string): Promise<void> {
		await this.db
			.delete(this.sessionsTable)
			.where(eq(this.sessionsTable.id, sessionId));
	}

	async invalidateUserSessions(userId: string): Promise<void> {
		await this.db
			.delete(this.sessionsTable)
			.where(eq(this.sessionsTable.userId, userId));
	}

	async listSessions(userId: string): Promise<Session[]> {
		const rows = await this.db
			.select()
			.from(this.sessionsTable)
			.where(eq(this.sessionsTable.userId, userId));
		const sessions: Session[] = [];
		for (const row of rows) {
			const session = toSession(row);
			if (session) sessions.push(session);
		}
		return sessions;
	}

	setSessionCookie(cookies: Cookies, session: Session): void {
		cookies.set(this.cookieName, session.id, {
			httpOnly: true,
			secure: this.secureCookies,
			sameSite: "lax",
			path: "/",
			expires: session.expiresAt,
		});
	}

	deleteSessionCookie(cookies: Cookies): void {
		cookies.delete(this.cookieName, {
			path: "/",
		});
	}
}
