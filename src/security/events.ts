export type AuthEventSeverity = "info" | "warn" | "error";

export type AuthEventName =
	| "auth.request"
	| "auth.success"
	| "auth.failure"
	| "auth.csrf_failed"
	| "auth.rate_limited"
	| "authz.denied";

export type AuthEvent = {
	name: AuthEventName;
	severity: AuthEventSeverity;
	timestamp: string;
	route: string;
	method: string;
	status?: number;
	message?: string;
	userId?: string | null;
	ip?: string;
	details?: Record<string, unknown>;
};

export type AuthEventEmitter = (event: AuthEvent) => Promise<void> | void;

export function createAuthEvent(
	input: Omit<AuthEvent, "timestamp">,
): AuthEvent {
	return {
		timestamp: new Date().toISOString(),
		...input,
	};
}
