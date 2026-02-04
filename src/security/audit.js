import { redactObject, DEFAULT_REDACT_KEYS } from "../utils/redact.js";

export function auditLog(event, options = {}) {
	const {
		logger = console,
		redactKeys = DEFAULT_REDACT_KEYS,
	} = options;

	const safeEvent = redactObject(event, redactKeys);
	logger.info("audit", safeEvent);
}

export function withAuditLogging({
	action = "unknown_action",
	includeRequestBody = false,
	includeResponse = false,
	logger = console,
	redactKeys = DEFAULT_REDACT_KEYS,
} = {}) {
	return (handler) => {
		return async (event) => {
			const start = Date.now();
			const { request, locals } = event;

			const auditContext = {
				action,
				timestamp: new Date().toISOString(),
				method: request.method,
				url: request.url,
				clientIP: locals?.clientIP || "unknown",
				userAgent: request.headers.get("user-agent") || "unknown",
				sessionId: locals?.sessionId || null,
			};

			if (includeRequestBody && request.method !== "GET") {
				try {
					auditContext.requestBody = await request.clone().json();
				} catch (error) {
					auditContext.requestBodyError = error.message;
				}
			}

			auditLog(auditContext, { logger, redactKeys });

			try {
				const response = await handler(event);
				const duration = Date.now() - start;
				const result = {
					...auditContext,
					status: response?.status || 200,
					duration,
					success: true,
				};

				if (includeResponse) {
					try {
						const responseBody = await response.clone().json();
						result.responseBody = responseBody;
					} catch (error) {
						result.responseBodyError = error.message;
					}
				}

				auditLog(result, { logger, redactKeys });
				return response;
			} catch (error) {
				const duration = Date.now() - start;
				auditLog(
					{
						...auditContext,
						error: error.message,
						stack: error.stack,
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
