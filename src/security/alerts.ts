import {
	createThresholdAlertObserver,
	type AlertSeverity as SharedAlertSeverity,
	type ThresholdAlert as SharedThresholdAlert,
	type ThresholdAlertObserverOptions,
	type ThresholdAlertRule as SharedThresholdAlertRule
} from '@goobits/security/alerting'

import type { AuthEvent } from './events.ts'

/** Auth alerts use the shared security vocabulary without informational notifications. */
export type AlertSeverity = Exclude<SharedAlertSeverity, 'info'>
export type SecurityAlert = SharedThresholdAlert<AuthEvent['name'], AlertSeverity>
export type SecurityAlertHandler = (alert: SecurityAlert) => Promise<void> | void
export type ThresholdRule = SharedThresholdAlertRule<AuthEvent['name'], AlertSeverity>

export type SecurityAlertConfig = Omit<
	ThresholdAlertObserverOptions<AuthEvent['name'], AlertSeverity>,
	'rules' | 'onAlert'
> & {
	rules?: ThresholdRule[]
	onAlert?: SecurityAlertHandler
}

const DEFAULT_RULES: ThresholdRule[] = [
	{ eventName: 'auth.failure', max: 10, windowMs: 10 * 60 * 1000, severity: 'warning' },
	{ eventName: 'auth.rate_limited', max: 20, windowMs: 5 * 60 * 1000, severity: 'warning' },
	{ eventName: 'auth.csrf_failed', max: 10, windowMs: 10 * 60 * 1000, severity: 'critical' }
]

/** Adapts auth events to the generic, shared threshold-alert mechanism. */
export function createSecurityAlertObserver({
	rules = DEFAULT_RULES,
	onAlert,
	store,
	keyPrefix = 'auth-alert',
	now
}: SecurityAlertConfig = {}) {
	return createThresholdAlertObserver<AuthEvent['name'], AlertSeverity>({
		rules,
		...(onAlert ? { onAlert } : {}),
		...(store ? { store } : {}),
		keyPrefix,
		...(now ? { now } : {})
	})
}
