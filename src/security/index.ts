export type {
	AlertSeverity,
	SecurityAlert,
	SecurityAlertConfig,
	SecurityAlertHandler,
	ThresholdRule
} from './alerts.ts'
export { createSecurityAlertObserver } from './alerts.ts'
export { createAuthEventAuditEmitter } from './audit.ts'
export {
	hasRecentMfaVerification,
	hasRecentPrimaryAuthentication,
	requireAuthenticated,
	requireOwnership,
	requireAuthRole,
	type SessionAssuranceWindow
} from './authorize.ts'
export type { AuthEvent, AuthEventEmitter, AuthEventName, AuthEventSeverity } from './events.ts'
export { createAuthEvent, emitRequestAuthEvent } from './events.ts'
export { applySecurityPolicy } from './policy.ts'
export {
	AUTH_RATE_LIMIT_WINDOWS,
	type AuthRateLimitConfig,
	type AuthRateLimitFlow,
	createAuthRateLimiter,
	createLoginRateLimiter,
	createPasswordResetRateLimiter,
	createRegistrationRateLimiter,
	getAuthRateLimitWindows
} from './rateLimit.ts'
