import type { AuthEvent } from "./events.js";

type AlertSeverity = "warn" | "error";

export type SecurityAlert = {
	type: "threshold_exceeded";
	eventName: AuthEvent["name"];
	severity: AlertSeverity;
	count: number;
	windowMs: number;
	timestamp: string;
};

export type SecurityAlertHandler = (alert: SecurityAlert) => Promise<void> | void;

type ThresholdRule = {
	eventName: AuthEvent["name"];
	max: number;
	windowMs: number;
	severity: AlertSeverity;
};

type SecurityAlertConfig = {
	rules?: ThresholdRule[];
	onAlert?: SecurityAlertHandler;
};

type EventWindow = {
	timestamps: number[];
};

const DEFAULT_RULES: ThresholdRule[] = [
	{ eventName: "auth.failure", max: 10, windowMs: 10 * 60 * 1000, severity: "warn" },
	{ eventName: "auth.rate_limited", max: 20, windowMs: 5 * 60 * 1000, severity: "warn" },
	{ eventName: "auth.csrf_failed", max: 10, windowMs: 10 * 60 * 1000, severity: "error" },
];

export function createSecurityAlertObserver({
	rules = DEFAULT_RULES,
	onAlert,
}: SecurityAlertConfig = {}) {
	const windows = new Map<string, EventWindow>();

	return async (event: AuthEvent): Promise<void> => {
		for (const rule of rules) {
			if (event.name !== rule.eventName) continue;
			const key = `${rule.eventName}:${rule.windowMs}`;
			const now = Date.now();
			const window = windows.get(key) ?? { timestamps: [] };
			const minTs = now - rule.windowMs;
			window.timestamps = window.timestamps.filter((ts) => ts >= minTs);
			window.timestamps.push(now);
			windows.set(key, window);
			if (window.timestamps.length >= rule.max && onAlert) {
				await onAlert({
					type: "threshold_exceeded",
					eventName: rule.eventName,
					severity: rule.severity,
					count: window.timestamps.length,
					windowMs: rule.windowMs,
					timestamp: new Date(now).toISOString(),
				});
				// Reset to avoid alert storms.
				window.timestamps = [];
				windows.set(key, window);
			}
		}
	};
}
