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
export declare function createSecurityAlertObserver({ rules, onAlert, }?: SecurityAlertConfig): (event: AuthEvent) => Promise<void>;
export {};
