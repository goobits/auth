import { createAuditLogger, type AuditLogger, type AuditOutcome } from '@goobits/security/audit'
import { DEFAULT_REDACT_KEYS, redactSensitive } from '@goobits/security/redaction'
import type { AuthEvent, AuthEventEmitter } from './events.ts'

/** Auth Audit Event typed model for runtime integration. */
export type AuthAuditEvent =
	| 'auth.success'
	| 'auth.failure'
	| 'magic_link.invalid'
	| 'magic_link.expired'
	| 'webauthn.challenge_missing'
	| 'webauthn.challenge_invalid_type'
	| 'webauthn.challenge_expired'
	| 'webauthn.credential_missing'
	| 'webauthn.authentication_failed'
	| 'session.revoked'

type AuthAuditOptions = {
	auditor?: AuditLogger
	redactKeys?: string[]
	outcome?: AuditOutcome
	actorId?: string
	targetId?: string
}

const defaultAuditor = createAuditLogger()

function eventOutcome(event: AuthEvent): AuditOutcome {
	if (event.severity === 'error') return 'error'
	if (
		event.name === 'auth.csrf_failed' ||
		event.name === 'auth.rate_limited' ||
		event.name === 'authz.denied'
	) {
		return 'denied'
	}
	if (event.name === 'auth.success' || (event.status !== undefined && event.status < 400)) {
		return 'success'
	}
	return 'failure'
}

/** Bridges Auth's route events into Security's canonical, awaitable audit pipeline. */
export function createAuthEventAuditEmitter({
	auditor,
	redactKeys = [...DEFAULT_REDACT_KEYS]
}: {
	auditor: AuditLogger
	redactKeys?: string[]
}): AuthEventEmitter {
	return async (event) => {
		const safeDetails = redactSensitive(event.details ?? {}, { keys: redactKeys })
		await auditor.log({
			action: event.name,
			outcome: eventOutcome(event),
			timestamp: event.timestamp,
			...(event.userId ? { actorId: event.userId } : {}),
			...(event.ip ? { clientIp: event.ip } : {}),
			method: event.method,
			url: event.route,
			...(event.status !== undefined ? { status: event.status } : {}),
			detail: {
				...(isRecord(safeDetails) ? safeDetails : {}),
				...(event.message ? { message: event.message } : {})
			}
		})
	}
}

/** Processes auth event for auth security checks. */
export function auditAuthEvent(
	event: AuthAuditEvent,
	payload: Record<string, unknown> = {},
	options: AuthAuditOptions = {}
): void {
	const safePayload = redactSensitive(payload, { keys: options.redactKeys ?? DEFAULT_REDACT_KEYS })
	const detail = isRecord(safePayload) ? safePayload : { payload: safePayload }
	const auditor = options.auditor ?? defaultAuditor
	const actorId = options.actorId ?? auditString(detail['userId'])
	const targetId = options.targetId ?? auditString(detail['sessionId'] ?? detail['credentialId'])

	void auditor.log({
		action: event,
		outcome: options.outcome ?? authAuditOutcome(event),
		...(actorId ? { actorId } : {}),
		...(targetId ? { targetId } : {}),
		detail
	})
}

function authAuditOutcome(event: AuthAuditEvent): AuditOutcome {
	return event === 'auth.success' ? 'success' : 'failure'
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === 'object' && !Array.isArray(value)
}

function auditString(value: unknown): string | undefined {
	return typeof value === 'string' && value.length > 0 ? value : undefined
}
