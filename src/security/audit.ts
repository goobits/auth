import { redactObject, DEFAULT_REDACT_KEYS } from "../utils/redact.js";
import type { RequestEvent } from "@sveltejs/kit";

type AuditLogger = {
	info: (message: string, payload?: unknown) => void;
};

type AuditOptions = {
	logger?: AuditLogger;
	redactKeys?: string[];
};

type AuditWrapperOptions = {
	action?: string;
	includeRequestBody?: boolean;
	includeResponse?: boolean;
	logger?: AuditLogger;
	redactKeys?: string[];
};

type AuthAuditEvent =
	| "auth.success"
	| "auth.failure"
	| "magic_link.invalid"
	| "magic_link.expired"
	| "webauthn.challenge_missing"
	| "webauthn.challenge_invalid_type"
	| "webauthn.credential_missing"
	| "webauthn.authentication_failed"
	| "session.revoked";

export function auditLog(event: unknown, options: AuditOptions = {}): void {
	const { logger = console, redactKeys = DEFAULT_REDACT_KEYS } = options;

	const safeEvent = redactObject(event, redactKeys);
	logger.info("audit", safeEvent);
}

export function withAuditLogging({
	action = "unknown_action",
	includeRequestBody = false,
	includeResponse = false,
	logger = console,
	redactKeys = DEFAULT_REDACT_KEYS,
}: AuditWrapperOptions = {}) {
	return (handler: (event: RequestEvent) => Promise<Response>) => {
		return async (event: RequestEvent): Promise<Response> => {
			const start = Date.now();
			const { request } = event;
			const locals = event.locals as Record<string, unknown>;

			const auditContext: Record<string, unknown> = {
				action,
				timestamp: new Date().toISOString(),
				method: request.method,
				url: request.url,
				clientIP: (locals["clientIP"] as string) || "unknown",
				userAgent: request.headers.get("user-agent") || "unknown",
				sessionId: (locals["sessionId"] as string) || null,
			};

			if (includeRequestBody && request.method !== "GET") {
				try {
					auditContext["requestBody"] = await request.clone().json();
				} catch (error) {
					auditContext["requestBodyError"] =
						error instanceof Error ? error.message : String(error);
				}
			}

			auditLog(auditContext, { logger, redactKeys });

			try {
				const response = await handler(event);
				const duration = Date.now() - start;
				const result: Record<string, unknown> = {
					...auditContext,
					status: response?.status || 200,
					duration,
					success: true,
				};

				if (includeResponse) {
					try {
						const responseBody = await response.clone().json();
						result["responseBody"] = responseBody;
					} catch (error) {
						result["responseBodyError"] =
							error instanceof Error ? error.message : String(error);
					}
				}

				auditLog(result, { logger, redactKeys });
				return response;
			} catch (error) {
				const duration = Date.now() - start;
				auditLog(
					{
						...auditContext,
						error: error instanceof Error ? error.message : String(error),
						stack: error instanceof Error ? error.stack : undefined,
						duration,
						success: false,
					},
					{ logger, redactKeys },
				);
				throw error;
			}
		};
	};
}

export function auditAuthEvent(
	event: AuthAuditEvent,
	payload: Record<string, unknown> = {},
	options: AuditOptions = {},
): void {
	auditLog(
		{
			category: "auth",
			event,
			timestamp: new Date().toISOString(),
			...payload,
		},
		options,
	);
}
