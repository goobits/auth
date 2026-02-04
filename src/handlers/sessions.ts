function jsonResponse(payload: any, status: number = 200): Response {
	return new Response(JSON.stringify(payload), {
		status,
		headers: { "content-type": "application/json" },
	});
}

async function parseRequestData(request: Request): Promise<Record<string, any>> {
	const contentType = request.headers.get("content-type") || "";
	if (contentType.includes("application/json")) {
		return request.json().catch(() => ({}));
	}
	if (
		contentType.includes("application/x-www-form-urlencoded") ||
		contentType.includes("multipart/form-data")
	) {
		const form = await request.formData();
		return Object.fromEntries((form as any).entries());
	}
	return {};
}

export function createSessionListHandler(config: any) {
	const {
		sessionAdapter,
		isAuthenticated = (locals: any) => !!locals.user,
		getUser = (locals: any) => locals.user,
		getSession = (locals: any) => locals.session,
	} = config;

	if (!sessionAdapter) {
		throw new Error("createSessionListHandler requires sessionAdapter");
	}

	return async (event: any) => {
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
		const normalized = sessions.map((session: any) => ({
			...session,
			current: current?.id === session.id,
		}));

		return jsonResponse({ ok: true, sessions: normalized });
	};
}

export function createSessionRevokeHandler(config: any) {
	const {
		sessionAdapter,
		isAuthenticated = (locals: any) => !!locals.user,
		getUser = (locals: any) => locals.user,
		getSession = (locals: any) => locals.session,
	} = config;

	if (!sessionAdapter) {
		throw new Error("createSessionRevokeHandler requires sessionAdapter");
	}

	return async (event: any) => {
		if (!isAuthenticated(event.locals)) {
			return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
		}

		const data = await parseRequestData(event.request);
		const user = getUser(event.locals);
		const current = getSession(event.locals);

		const sessionId = data.sessionId || data.id;
		const revokeAll = data.all === true || data.all === "true";
		const revokeOthers = data.others === true || data.others === "true";

		if (sessionId) {
			if (typeof sessionAdapter.listSessions !== "function") {
				return jsonResponse(
					{ ok: false, error: "Session listing not supported" },
					501,
				);
			}
			const sessions = await sessionAdapter.listSessions(user.id);
			const ownsSession = sessions.some((session: any) => session.id === sessionId);
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
					.filter((session: any) => session.id !== current?.id)
					.map((session: any) => sessionAdapter.invalidateSession(session.id)),
			);
			return jsonResponse({ ok: true });
		}

		return jsonResponse({ ok: false, error: "Missing revoke target" }, 400);
	};
}
