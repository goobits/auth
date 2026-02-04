import { SessionAdapter } from "./base.js";
import { generateRandomUUID } from "../../utils/crypto.js";

export class KVSessionAdapter extends SessionAdapter {
	constructor(namespace, options = {}) {
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

	_defaultSanitizeUser(user) {
		if (!user) return null;
		const { password, token, ...safeUser } = user;
		return safeUser;
	}

	_key(sessionId) {
		return `${this.keyPrefix}:${sessionId}`;
	}

	async createSession(userId, metadata = {}) {
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

	async validateSession(sessionId) {
		const raw = await this.namespace.get(this._key(sessionId), { type: "json" });
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
			? this.sanitizeUser(await this.getUserById(raw.userId))
			: null;

		return {
			session: { id: sessionId, userId: raw.userId, expiresAt: newExpiresAt, fresh },
			user,
		};
	}

	async invalidateSession(sessionId) {
		await this.namespace.delete(this._key(sessionId));
	}

	async invalidateUserSessions(_userId) {
		throw new Error("KVSessionAdapter does not support invalidateUserSessions");
	}

	async listSessions(userId) {
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
		cookies.delete(this.cookieName, { path: "/" });
	}
}
