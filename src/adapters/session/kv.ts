// @ts-nocheck
import { SessionAdapter } from "./base.ts";
import { generateRandomUUID } from "../../utils/crypto.ts";
import type { Cookies } from "@sveltejs/kit";

type KVNamespaceLike = {
	put: (key: string, value: string, options?: { expirationTtl?: number }) => Promise<void>;
	get: (
		key: string,
		options?: { type?: "json" | "text" },
	) => Promise<Record<string, unknown> | string | null>;
	delete: (key: string) => Promise<void>;
	list?: (options?: { prefix?: string }) => Promise<{ keys?: Array<{ name: string }> }>;
};

export class KVSessionAdapter extends SessionAdapter {
	private namespace: KVNamespaceLike;
	private sessionLifetime: number;
	private sessionRefreshThreshold: number;
	private cookieName: string;
	private secureCookies: boolean;
	private getUserById: ((id: string) => Promise<Record<string, unknown> | null>) | null;
	private sanitizeUser: (user: Record<string, unknown> | null) => Record<string, unknown> | null;
	private keyPrefix: string;

	constructor(
		namespace: KVNamespaceLike,
		options: {
			sessionLifetime?: number;
			sessionRefreshThreshold?: number;
			cookieName?: string;
			secureCookies?: boolean;
			getUserById?: (id: string) => Promise<Record<string, unknown> | null>;
			sanitizeUser?: (user: Record<string, unknown> | null) => Record<string, unknown> | null;
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

	_defaultSanitizeUser(user: Record<string, unknown> | null) {
		if (!user) return null;
		const { password, token, ...safeUser } = user;
		return safeUser;
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

	async validateSession(sessionId: string) {
		const raw = (await this.namespace.get(this._key(sessionId), { type: "json" })) as
			| { userId?: string; expiresAt?: string }
			| null;
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

	async listSessions(userId: string) {
		if (typeof this.namespace.list !== "function") {
			throw new Error("KVSessionAdapter does not support listSessions");
		}
		const keys = await this.namespace.list({ prefix: `${this.keyPrefix}:` });
		const sessions = [];
		for (const key of keys.keys ?? []) {
			const raw = await this.namespace.get(key.name, { type: "json" });
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
