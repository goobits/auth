import type { RateLimitStore } from '@goobits/security/rate-limit'

import type { AuthEvent } from './events.ts'

export type AlertSeverity = 'warn' | 'error'

export type SecurityAlert = {
	type: 'threshold_exceeded'
	eventName: AuthEvent['name']
	severity: AlertSeverity
	count: number
	windowMs: number
	timestamp: string
}

export type SecurityAlertHandler = (alert: SecurityAlert) => Promise<void> | void

export type ThresholdRule = {
	eventName: AuthEvent['name']
	max: number
	windowMs: number
	severity: AlertSeverity
}

export type SecurityAlertConfig = {
	rules?: ThresholdRule[]
	onAlert?: SecurityAlertHandler
	store?: RateLimitStore
	keyPrefix?: string
}

type EventWindow = {
	timestamps: number[]
}

const DEFAULT_RULES: ThresholdRule[] = [
	{ eventName: 'auth.failure', max: 10, windowMs: 10 * 60 * 1000, severity: 'warn' },
	{ eventName: 'auth.rate_limited', max: 20, windowMs: 5 * 60 * 1000, severity: 'warn' },
	{ eventName: 'auth.csrf_failed', max: 10, windowMs: 10 * 60 * 1000, severity: 'error' }
]

/** Creates security alert observer for auth security checks. */
export function createSecurityAlertObserver({
	rules = DEFAULT_RULES,
	onAlert,
	store,
	keyPrefix = 'auth-alert'
}: SecurityAlertConfig = {}) {
	const windows = new Map<string, EventWindow>()

	return async (event: AuthEvent): Promise<void> => {
		for (const rule of rules) {
			if (event.name !== rule.eventName) continue
			const key = `${keyPrefix}:${rule.eventName}:${rule.max}:${rule.windowMs}:${rule.severity}`
			const now = Date.now()
			if (store) {
				const entry = await store.incrementEntry(key, now, rule.windowMs)
				const minTs = now - rule.windowMs
				const count = entry.timestamps.filter((timestamp) => timestamp >= minTs).length
				if (count >= rule.max && onAlert) {
					const bucket = Math.floor(now / rule.windowMs)
					const alertClaim = await store.incrementEntry(
						`${key}:notification:${bucket}`,
						now,
						rule.windowMs
					)
					const claimCount = alertClaim.timestamps.filter((timestamp) => timestamp >= minTs).length
					if (claimCount !== 1) continue
					await onAlert({
						type: 'threshold_exceeded',
						eventName: rule.eventName,
						severity: rule.severity,
						count,
						windowMs: rule.windowMs,
						timestamp: new Date(now).toISOString()
					})
				}
				continue
			}

			const window = windows.get(key) ?? { timestamps: [] }
			const minTs = now - rule.windowMs
			window.timestamps = window.timestamps.filter((ts) => ts >= minTs)
			window.timestamps.push(now)
			windows.set(key, window)
			if (window.timestamps.length >= rule.max && onAlert) {
				await onAlert({
					type: 'threshold_exceeded',
					eventName: rule.eventName,
					severity: rule.severity,
					count: window.timestamps.length,
					windowMs: rule.windowMs,
					timestamp: new Date(now).toISOString()
				})

				// Reset to avoid alert storms.
				window.timestamps = []
				windows.set(key, window)
			}
		}
	}
}
