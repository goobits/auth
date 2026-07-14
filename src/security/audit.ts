import { createAuditLogger, type AuditLogger, type AuditOutcome } from '@goobits/security/audit'

import { DEFAULT_REDACT_KEYS, redactObject } from '../utils/redact.ts'

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

/** Processes auth event for auth security checks. */
export function auditAuthEvent(
	event: AuthAuditEvent,
	payload: Record<string, unknown> = {},
	options: AuthAuditOptions = {}
): void {
	const safePayload = redactObject(payload, options.redactKeys ?? DEFAULT_REDACT_KEYS)
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
