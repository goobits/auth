import type { AuditLogger, AuditOutcome } from '@goobits/security/audit'
import { DEFAULT_REDACT_KEYS, redactSensitive } from '@goobits/security/redaction'
import type { AuthEvent, AuthEventEmitter } from './events.ts'

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
				...(isRecord(safeDetails) ? safeDetails : {})
			}
		})
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === 'object' && !Array.isArray(value)
}
