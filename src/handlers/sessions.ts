import { jsonResponse, parseRequestData } from "../utils/http.js";
import type { AuthLocals, RequestEventLike } from "../types/auth.js";
import type { SessionSummary, Session } from "../types/index.js";
import { AuthAdapterCapabilityError } from "../errors/auth.js";

type SessionAdapterLike = {
	listSessions?: (userId: string) => Promise<SessionSummary[]>;
	invalidateSession?: (sessionId: string) => Promise<void>;
	invalidateUserSessions?: (userId: string) => Promise<void>;
	deleteSessionCookie?: (cookies: RequestEventLike["cookies"]) => void;
};

type SessionHandlerConfig = {
	sessionAdapter: SessionAdapterLike;
	isAuthenticated?: (locals: AuthLocals) => boolean;
	getUser?: (locals: AuthLocals) => { id: string };
	getSession?: (locals: AuthLocals) => Session | null;
};

export function createSessionListHandler(config: SessionHandlerConfig) {
	const {
		sessionAdapter,
		isAuthenticated = (locals: AuthLocals) => !!locals.user,
		getUser = (locals: AuthLocals) => locals.user as { id: string },
		getSession = (locals: AuthLocals) => locals.session ?? null,
	} = config;

	if (!sessionAdapter) {
		throw new Error("createSessionListHandler requires sessionAdapter");
	}

	return async (event: RequestEventLike) => {
		if (!isAuthenticated(event.locals)) {
			return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
		}

		if (typeof sessionAdapter.listSessions !== "function") {
			return jsonResponse(
				{ ok: false, error: "Session listing not supported" },
				501,
			);
		}

		const user = getUser(event.locals);
		const current = getSession(event.locals);
		const sessions = await sessionAdapter.listSessions(user.id);
		const normalized = sessions.map((session) => ({
			...session,
			current: current?.id === session.id,
		}));

		return jsonResponse({ ok: true, sessions: normalized });
	};
}

export function createSessionRevokeHandler(config: SessionHandlerConfig) {
	const {
		sessionAdapter,
		isAuthenticated = (locals: AuthLocals) => !!locals.user,
		getUser = (locals: AuthLocals) => locals.user as { id: string },
		getSession = (locals: AuthLocals) => locals.session ?? null,
	} = config;

	if (!sessionAdapter) {
		throw new Error("createSessionRevokeHandler requires sessionAdapter");
	}

	return async (event: RequestEventLike) => {
		if (!isAuthenticated(event.locals)) {
			return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
		}

		const isUnsupportedError = (error: unknown): boolean =>
			error instanceof AuthAdapterCapabilityError ||
			(error instanceof Error &&
				(error.message.includes("not support") ||
					error.message.includes("not implemented")));

		const data = await parseRequestData(event.request);
		const user = getUser(event.locals);
		const current = getSession(event.locals);

		const sessionId =
			typeof data["sessionId"] === "string"
				? data["sessionId"]
				: typeof data["id"] === "string"
					? data["id"]
					: "";
		const revokeAll =
			data["all"] === true || data["all"] === "true" || data["all"] === 1;
		const revokeOthers =
			data["others"] === true || data["others"] === "true" || data["others"] === 1;

		if (sessionId) {
			if (typeof sessionAdapter.listSessions !== "function") {
				return jsonResponse(
					{ ok: false, error: "Session listing not supported" },
					501,
				);
			}
			const sessions = await sessionAdapter.listSessions(user.id);
			const ownsSession = sessions.some((session) => session.id === sessionId);
			if (!ownsSession) {
				return jsonResponse({ ok: false, error: "Session not found" }, 404);
			}
			if (typeof sessionAdapter.invalidateSession !== "function") {
				return jsonResponse(
					{ ok: false, error: "Session invalidation not supported" },
					501,
				);
			}
			try {
				await sessionAdapter.invalidateSession(sessionId);
			} catch (error) {
				if (isUnsupportedError(error)) {
					return jsonResponse(
						{ ok: false, error: "Session invalidation not supported" },
						501,
					);
				}
				return jsonResponse({ ok: false, error: "Failed to revoke session" }, 500);
			}
			if (current?.id === sessionId && sessionAdapter.deleteSessionCookie) {
				sessionAdapter.deleteSessionCookie(event.cookies);
			}
			return jsonResponse({ ok: true });
		}

		if (revokeAll) {
			if (typeof sessionAdapter.invalidateUserSessions !== "function") {
				return jsonResponse(
					{ ok: false, error: "Bulk session revocation not supported" },
					501,
				);
			}
			try {
				await sessionAdapter.invalidateUserSessions(user.id);
			} catch (error) {
				if (isUnsupportedError(error)) {
					return jsonResponse(
						{ ok: false, error: "Bulk session revocation not supported" },
						501,
					);
				}
				return jsonResponse({ ok: false, error: "Failed to revoke sessions" }, 500);
			}
			if (sessionAdapter.deleteSessionCookie) {
				sessionAdapter.deleteSessionCookie(event.cookies);
			}
			return jsonResponse({ ok: true });
		}

		if (revokeOthers) {
			if (typeof sessionAdapter.listSessions !== "function") {
				return jsonResponse(
					{ ok: false, error: "Session listing not supported" },
					501,
				);
			}
			const sessions = await sessionAdapter.listSessions(user.id);
			if (typeof sessionAdapter.invalidateSession !== "function") {
				return jsonResponse(
					{ ok: false, error: "Session invalidation not supported" },
					501,
				);
			}
			try {
				await Promise.all(
					sessions
						.filter((session) => session.id !== current?.id)
						.map((session) => sessionAdapter.invalidateSession!(session.id)),
				);
			} catch (error) {
				if (isUnsupportedError(error)) {
					return jsonResponse(
						{ ok: false, error: "Session invalidation not supported" },
						501,
					);
				}
				return jsonResponse({ ok: false, error: "Failed to revoke sessions" }, 500);
			}
			return jsonResponse({ ok: true });
		}

		return jsonResponse({ ok: false, error: "Missing revoke target" }, 400);
	};
}
