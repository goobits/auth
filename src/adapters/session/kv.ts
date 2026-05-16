import { SessionAdapter } from "./base.js";
import { generateRandomUUID } from "../../utils/crypto.js";
import type { Cookies } from "@sveltejs/kit";
import type { Session, User } from "../../types/index.js";

type KVNamespaceLike = {
	put: (key: string, value: string, options?: { expirationTtl?: number }) => Promise<void>;
	get: (
		key: string,
		options?: { type?: "json" | "text" },
	) => Promise<Record<string, unknown> | string | null>;
	delete: (key: string) => Promise<void>;
	list?: (options?: { prefix?: string }) => Promise<{ keys?: Array<{ name: string }> }>;
};

type KVSessionRecord = {
	userId: string;
	expiresAt: string;
};

function isKVSessionRecord(value: Record<string, unknown> | string | null): value is KVSessionRecord {
	if (!value || typeof value !== "object") return false;
	return (
		"userId" in value &&
		typeof value["userId"] === "string" &&
		"expiresAt" in value &&
		typeof value["expiresAt"] === "string"
	);
}

export class KVSessionAdapter extends SessionAdapter {
	private namespace: KVNamespaceLike;
	private sessionLifetime: number;
	private sessionRefreshThreshold: number;
	// Exposed for auth hook resolution (`createAuth` reads adapter.cookieName).
	cookieName: string;
	private secureCookies: boolean;
	private getUserById: ((id: string) => Promise<User | null>) | null;
	private sanitizeUser: (user: User | null) => User | null;
	private keyPrefix: string;

	constructor(
		namespace: KVNamespaceLike,
		options: {
			sessionLifetime?: number;
			sessionRefreshThreshold?: number;
			cookieName?: string;
			secureCookies?: boolean;
			getUserById?: (id: string) => Promise<User | null>;
			sanitizeUser?: (user: User | null) => User | null;
			keyPrefix?: string;
		} = {},
	) {
		super();
		this.namespace = namespace;
		this.sessionLifetime = options.sessionLifetime || 30 * 24 * 60 * 60 * 1000;
		this.sessionRefreshThreshold =
			options.sessionRefreshThreshold || this.sessionLifetime / 2;
		this.cookieName = options.cookieName || "session";
		this.secureCookies = options.secureCookies !== false;
		this.getUserById = options.getUserById || null;
		this.sanitizeUser = options.sanitizeUser || this._defaultSanitizeUser;
		this.keyPrefix = options.keyPrefix || "session";
	}

	_defaultSanitizeUser(user: User | null): User | null {
		return user;
	}

	_key(sessionId: string) {
		return `${this.keyPrefix}:${sessionId}`;
	}

	async createSession(userId: string, metadata: Record<string, unknown> = {}) {
		const sessionId = await generateRandomUUID();
		const expiresAt = new Date(Date.now() + this.sessionLifetime);
		const payload = {
			userId,
			expiresAt: expiresAt.toISOString(),
		};
		await this.namespace.put(
			this._key(sessionId),
			JSON.stringify(payload),
			{ expirationTtl: Math.ceil(this.sessionLifetime / 1000) },
		);
		return { id: sessionId, userId, expiresAt, ...metadata };
	}

	async validateSession(sessionId: string): Promise<{
		session: Session | null;
		user: User | null;
	}> {
		const rawValue = await this.namespace.get(this._key(sessionId), { type: "json" });
		const raw = isKVSessionRecord(rawValue) ? rawValue : null;
		if (!raw) return { session: null, user: null };

		const expiresAt = new Date(raw.expiresAt);
		if (Date.now() >= expiresAt.getTime()) {
			await this.namespace.delete(this._key(sessionId));
			return { session: null, user: null };
		}

		const shouldRefresh =
			Date.now() >= expiresAt.getTime() - this.sessionRefreshThreshold;
		let fresh = false;
		let newExpiresAt = expiresAt;

		if (shouldRefresh) {
			newExpiresAt = new Date(Date.now() + this.sessionLifetime);
			await this.namespace.put(
				this._key(sessionId),
				JSON.stringify({ userId: raw.userId, expiresAt: newExpiresAt.toISOString() }),
				{ expirationTtl: Math.ceil(this.sessionLifetime / 1000) },
			);
			fresh = true;
		}

		const user = this.getUserById
			? this.sanitizeUser(await this.getUserById(String(raw.userId ?? "")))
			: null;

		return {
			session: { id: sessionId, userId: raw.userId, expiresAt: newExpiresAt, fresh },
			user,
		};
	}

	async invalidateSession(sessionId: string) {
		await this.namespace.delete(this._key(sessionId));
	}

	async invalidateUserSessions(_userId: string) {
		throw new Error("KVSessionAdapter does not support invalidateUserSessions");
	}

	async listSessions(userId: string): Promise<Session[]> {
		if (typeof this.namespace.list !== "function") {
			throw new Error("KVSessionAdapter does not support listSessions");
		}
		const keys = await this.namespace.list({ prefix: `${this.keyPrefix}:` });
		const sessions: Session[] = [];
		for (const key of keys.keys ?? []) {
			const rawValue = await this.namespace.get(key.name, { type: "json" });
			const raw = isKVSessionRecord(rawValue) ? rawValue : null;
			if (!raw) continue;
			if (raw.userId !== userId) continue;
			sessions.push({
				id: key.name.replace(`${this.keyPrefix}:`, ""),
				userId: raw.userId,
				expiresAt: new Date(raw.expiresAt),
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
		cookies.delete(this.cookieName, { path: "/" });
	}
}
