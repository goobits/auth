import { validateCsrfRequest } from "./csrf.js";
import { createRateLimiter } from "./rate-limit.js";
import type { RateLimitStore } from "./rate-limit.js";
import { createAuthEvent, type AuthEventEmitter } from "./events.js";
import type { RequestEventLike } from "../types/auth.js";
import type { CsrfStore } from "./csrf.js";
import type { RequestHandler } from "@sveltejs/kit";

type PolicyMode = "required" | "optional" | "off";

export type SecurityRouteId =
	| "oauth.login"
	| "oauth.callback"
	| "auth.logout"
	| "magic.request"
	| "magic.verify"
	| "webauthn.register.options"
	| "webauthn.register.verify"
	| "webauthn.login.options"
	| "webauthn.login.verify"
	| "sessions.list"
	| "sessions.revoke";

export type SecurityRoutePolicy = {
	csrf?: PolicyMode;
	rateLimit?: PolicyMode;
	audit?: PolicyMode;
};

export type SecurityPolicySettings = {
	csrf: {
		mode: PolicyMode;
		cookieName: string;
		headerName: string;
		checkExpiry: boolean;
		store?: CsrfStore;
	};
		rateLimit: {
			mode: PolicyMode;
			max: number;
			windowMs: number;
			keyPrefix: string;
			trustProxyHeader: boolean;
			store?: RateLimitStore;
		};
	audit: {
		mode: PolicyMode;
		emitter?: AuthEventEmitter;
	};
	routes: Partial<Record<SecurityRouteId, SecurityRoutePolicy>>;
};

type ApplyPolicyInput = {
	handler: RequestHandler;
	routeId: SecurityRouteId;
	settings: SecurityPolicySettings;
};

function jsonError(status: number, message: string): Response {
	return new Response(JSON.stringify({ ok: false, error: message }), {
		status,
		headers: { "content-type": "application/json" },
	});
}

function getClientIp(event: RequestEventLike, trustProxyHeader: boolean): string {
	if (event.getClientAddress) return event.getClientAddress();
	if (trustProxyHeader) return event.request.headers.get("x-forwarded-for") ?? "unknown";
	return "unknown";
}

export function applySecurityPolicy({
	handler,
	routeId,
	settings,
}: ApplyPolicyInput) {
	const limiter = createRateLimiter({
		windowMs: settings.rateLimit.windowMs,
		max: settings.rateLimit.max,
		keyPrefix: settings.rateLimit.keyPrefix,
		...(settings.rateLimit.store ? { store: settings.rateLimit.store } : {}),
	});

	return async (event: RequestEventLike): Promise<Response> => {
		const method = event.request.method.toUpperCase();
		const routePolicy = settings.routes[routeId] ?? {};
		const csrfMode = routePolicy.csrf ?? settings.csrf.mode;
		const rateMode = routePolicy.rateLimit ?? settings.rateLimit.mode;
		const auditMode = routePolicy.audit ?? settings.audit.mode;
		const ip = getClientIp(event, settings.rateLimit.trustProxyHeader);

		const emit = async (
			name: Parameters<typeof createAuthEvent>[0]["name"],
			severity: Parameters<typeof createAuthEvent>[0]["severity"],
			status?: number,
			message?: string,
			details?: Record<string, unknown>,
		) => {
			if (auditMode === "off" || !settings.audit.emitter) return;
			const payload = {
				name,
				severity,
				route: routeId,
				method,
				ip,
				...(status !== undefined ? { status } : {}),
				...(message !== undefined ? { message } : {}),
				...(event.locals.user?.id ? { userId: String(event.locals.user.id) } : { userId: null }),
				...(details !== undefined ? { details } : {}),
			};
			await settings.audit.emitter(createAuthEvent(payload));
		};

		if (rateMode !== "off") {
			const key = `${routeId}:${ip}`;
			const result = await limiter(key);
			if (!result.allowed) {
				await emit("auth.rate_limited", "warn", 429, "Too many requests");
				return jsonError(429, "Too many requests");
			}
		}

		const isStateChanging =
			method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE";
		if (isStateChanging && csrfMode === "required") {
			const valid = await validateCsrfRequest({
				request: event.request,
				cookies: event.cookies,
				headerName: settings.csrf.headerName,
				cookieName: settings.csrf.cookieName,
				checkExpiry: settings.csrf.checkExpiry,
				...(settings.csrf.store ? { store: settings.csrf.store } : {}),
			});
			if (!valid) {
				await emit("auth.csrf_failed", "warn", 403, "Invalid CSRF token");
				return jsonError(403, "Invalid CSRF token");
			}
		}

		await emit("auth.request", "info");
		try {
			const response = await handler(event as Parameters<RequestHandler>[0]);
			await emit(
				response.status >= 400 ? "auth.failure" : "auth.success",
				response.status >= 400 ? "warn" : "info",
				response.status,
			);
			return response;
		} catch (error) {
			const message = error instanceof Error ? error.message : "Request failed";
			await emit("auth.failure", "error", 500, message);
			throw error;
		}
	};
}
