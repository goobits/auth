import { SessionAdapter } from "./base.js";
import { encodeBase64url } from "@oslojs/encoding";
import type { Cookies } from "@sveltejs/kit";

/**
 * Cookie-based Session Adapter
 * Simple session management using cookies only (no database)
 * Best for stateless applications or serverless deployments
 */
export class CookieSessionAdapter extends SessionAdapter {
	// Exposed for auth hook resolution (`createAuth` reads adapter.cookieName).
	cookieName: string;
	private secureCookies: boolean;
	private sessionLifetime: number;
	private _sessions: Map<string, { id: string; userId: string; expiresAt: Date; [key: string]: unknown }>;
	/**
	 * @param {Object} options - Configuration options
	 * @param {string} [options.cookieName='session'] - Session cookie name
	 * @param {boolean} [options.secureCookies=true] - Use secure cookies
	 * @param {number} [options.sessionLifetime=2592000000] - Session lifetime in ms (default: 30 days)
	 */
	constructor(
		options: {
			cookieName?: string;
			secureCookies?: boolean;
			sessionLifetime?: number;
		} = {},
	) {
		super();
		this.cookieName = options.cookieName || "session";
		this.secureCookies = options.secureCookies !== false;
		this.sessionLifetime = options.sessionLifetime || 30 * 24 * 60 * 60 * 1000; // 30 days

		// In-memory session storage (for simple apps)
		// In production, you might want Redis or similar
		this._sessions = new Map();
	}

	/**
	 * Generate cryptographically secure session ID
	 * @returns {string}
	 * @private
	 */
	_generateSessionId(): string {
		const bytes = new Uint8Array(20);
		crypto.getRandomValues(bytes);
		// Cookie values are not reliably percent-decoded by all runtimes. Avoid '=' padding
		// so we never emit values that need encoding like `%3D`.
		return encodeBase64url(bytes).replace(/=+$/g, "");
	}

	async createSession(userId: string, metadata: Record<string, unknown> = {}) {
		const sessionId = this._generateSessionId();
		const expiresAt = new Date(Date.now() + this.sessionLifetime);

		const session = {
			id: sessionId,
			userId,
			expiresAt,
			...metadata,
		};

		this._sessions.set(sessionId, session);

		return session;
	}

	async validateSession(sessionId: string) {
		const session = this._sessions.get(sessionId);

		if (!session) {
			return { session: null, user: null };
		}

		// Check if expired
		if (Date.now() >= session.expiresAt.getTime()) {
			this._sessions.delete(sessionId);
			return { session: null, user: null };
		}

		// For cookie-based sessions, we don't have user data
		// The user data should be stored separately (e.g., in another cookie)
		// or retrieved from a user store
		return { session, user: null };
	}

	async invalidateSession(sessionId: string) {
		this._sessions.delete(sessionId);
	}

	async invalidateUserSessions(userId: string) {
		// Find and delete all sessions for this user
		for (const [sessionId, session] of this._sessions.entries()) {
			if (session.userId === userId) {
				this._sessions.delete(sessionId);
			}
		}
	}

	async listSessions(userId: string) {
		const sessions = [];
		for (const session of this._sessions.values()) {
			if (session.userId === userId) {
				sessions.push(session);
			}
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
