export type AuthEventSeverity = 'info' | 'warn' | 'error'

export type AuthEventName =
	| 'auth.request'
	| 'auth.success'
	| 'auth.failure'
	| 'auth.csrf_failed'
	| 'auth.rate_limited'
	| 'authz.denied'
	| 'magic_link.invalid'
	| 'magic_link.expired'
	| 'webauthn.challenge_missing'
	| 'webauthn.challenge_invalid_type'
	| 'webauthn.challenge_expired'
	| 'webauthn.credential_missing'
	| 'webauthn.authentication_failed'
	| 'session.revoked'

export type AuthEvent = {
	name: AuthEventName
	severity: AuthEventSeverity
	timestamp: string
	route: string
	method: string
	status?: number
	message?: string
	userId?: string | null
	ip?: string
	details?: Record<string, unknown>
}

export type AuthEventEmitter = (event: AuthEvent) => Promise<void> | void

/** Creates auth event for auth security checks. */
export function createAuthEvent(input: Omit<AuthEvent, 'timestamp'>): AuthEvent {
	return {
		timestamp: new Date().toISOString(),
		...input
	}
}

/** Emits a handler outcome through the configured, awaitable Auth event pipeline. */
export async function emitRequestAuthEvent(
	emitter: AuthEventEmitter | undefined,
	event: RequestEventLike,
	input: Pick<AuthEvent, 'name' | 'severity'> &
		Partial<Pick<AuthEvent, 'status' | 'message' | 'details'>>
): Promise<void> {
	if (!emitter) return
	let ip: string | undefined
	try {
		ip = event.getClientAddress?.()
	} catch {
		ip = undefined
	}
	await emitter(
		createAuthEvent({
			...input,
			route: event.url.pathname,
			method: event.request.method,
			userId: event.locals.user?.id ? String(event.locals.user.id) : null,
			...(ip ? { ip } : {})
		})
	)
}
import type { RequestEventLike } from '../types/auth.ts'
