import { jsonResponse, parseRequestData } from "../utils/http.ts";
import type { AuthLocals, RequestEventLike } from "../types/auth.ts";
import type { SessionSummary, Session } from "../types/index.ts";

type SessionAdapterLike = {
	listSessions?: (userId: string) => Promise<SessionSummary[]>;
	invalidateSession: (sessionId: string) => Promise<void>;
	invalidateUserSessions: (userId: string) => Promise<void>;
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

		const data = await parseRequestData(event.request);
		const user = getUser(event.locals);
		const current = getSession(event.locals);

		const sessionId =
			typeof data.sessionId === "string"
				? data.sessionId
				: typeof data.id === "string"
					? data.id
					: "";
		const revokeAll =
			data.all === true || data.all === "true" || data.all === 1;
		const revokeOthers =
			data.others === true || data.others === "true" || data.others === 1;

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
			await sessionAdapter.invalidateSession(sessionId);
			if (current?.id === sessionId && sessionAdapter.deleteSessionCookie) {
				sessionAdapter.deleteSessionCookie(event.cookies);
			}
			return jsonResponse({ ok: true });
		}

		if (revokeAll) {
			await sessionAdapter.invalidateUserSessions(user.id);
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
			await Promise.all(
				sessions
					.filter((session) => session.id !== current?.id)
					.map((session) => sessionAdapter.invalidateSession(session.id)),
			);
			return jsonResponse({ ok: true });
		}

		return jsonResponse({ ok: false, error: "Missing revoke target" }, 400);
	};
}
