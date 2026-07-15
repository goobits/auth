import { createWebhookChannel, type AlertChannel } from '@goobits/security/alerting'
import { createSecurityAlertObserver } from '../security/alerts.ts'
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME, MemoryCsrfStore } from '../security/csrf.ts'
import { createAuthEvent } from '../security/events.ts'
import { applySecurityPolicy, type SecurityPolicySettings } from '../security/policy.ts'
import type {
	AuthConfig,
	AuthHandlers,
	AuthSecurityConfig,
	SecurityProfile,
	TrustedProxyHeader
} from '../types/auth.ts'

export type ResolvedSecurity = SecurityPolicySettings & {
	profile: SecurityProfile
}

const PROFILE_DEFAULTS: Record<SecurityProfile, AuthSecurityConfig> = {
	basic: {
		csrf: { mode: 'off' },
		rateLimit: { mode: 'optional', max: 20, windowMs: 60_000, keyPrefix: 'auth' },
		audit: { mode: 'optional' }
	},
	secure: {
		csrf: { mode: 'required', checkExpiry: false },
		rateLimit: {
			mode: 'required',
			max: 20,
			windowMs: 60_000,
			keyPrefix: 'auth',
			trustProxyHeader: false
		},
		audit: { mode: 'required' },
		alerts: { enabled: true }
	},
	strict: {
		csrf: { mode: 'required', checkExpiry: true },
		rateLimit: {
			mode: 'required',
			max: 10,
			windowMs: 60_000,
			keyPrefix: 'auth',
			trustProxyHeader: false
		},
		audit: { mode: 'required' },
		alerts: { enabled: true }
	}
}

const TRUSTED_PROXY_HEADERS = new Set<TrustedProxyHeader>(['cf-connecting-ip', 'x-forwarded-for'])

function resolveTrustedProxyHeaders(
	rateLimit: AuthSecurityConfig['rateLimit']
): TrustedProxyHeader[] {
	const explicitHeaders = rateLimit?.trustedProxyHeaders
	if (explicitHeaders && explicitHeaders.length > 0) {
		return Array.from(
			new Set(explicitHeaders.filter((header) => TRUSTED_PROXY_HEADERS.has(header)))
		)
	}
	return rateLimit?.trustProxyHeader === true ? ['x-forwarded-for'] : []
}

function isProductionRuntime(): boolean {
	return typeof process !== 'undefined' && process.env['NODE_ENV'] === 'production'
}

function assertProfileRequirements(profile: SecurityProfile, security: AuthSecurityConfig): void {
	if (profile === 'basic') return
	const csrfMode = security.csrf?.mode ?? 'required'
	const externalCsrfBoundary = security.csrf?.externalBoundary === true

	if (profile === 'strict' && (csrfMode !== 'required' || externalCsrfBoundary)) {
		throw new Error('The strict auth profile requires built-in CSRF protection')
	}
	if (
		profile === 'secure' &&
		csrfMode !== 'required' &&
		!(csrfMode === 'off' && externalCsrfBoundary)
	) {
		throw new Error(
			"The secure auth profile requires CSRF protection or csrf.externalBoundary with mode 'off'"
		)
	}
	if (externalCsrfBoundary && csrfMode !== 'off') {
		throw new Error("csrf.externalBoundary may only be used with csrf.mode 'off'")
	}
	if (security.rateLimit?.mode !== 'required') {
		throw new Error(`${profile} auth profile requires rate limiting`)
	}
	if (isProductionRuntime() && !security.rateLimit.store) {
		throw new Error(`${profile} auth profile requires a shared rate-limit store in production`)
	}
	if (
		isProductionRuntime() &&
		csrfMode === 'required' &&
		security.csrf?.checkExpiry === true &&
		!security.csrf.store
	) {
		throw new Error(`${profile} auth profile requires a shared CSRF store in production`)
	}
}

export function resolveSecurity(config: AuthConfig): ResolvedSecurity {
	const profile = config.profile ?? 'secure'
	const base = PROFILE_DEFAULTS[profile]
	const merged: AuthSecurityConfig = {
		csrf: { ...base.csrf, ...config.security?.csrf },
		rateLimit: { ...base.rateLimit, ...config.security?.rateLimit },
		audit: { ...base.audit, ...config.security?.audit },
		alerts: { ...base.alerts, ...config.security?.alerts }
	}
	assertProfileRequirements(profile, merged)
	const csrfStore = merged.csrf?.store ?? new MemoryCsrfStore()
	const webhook = merged.alerts?.webhook
	const fallbackWebhookUrl =
		typeof process !== 'undefined' ? process.env['SECURITY_WEBHOOK_URL'] : undefined
	const webhookUrl = webhook?.url ?? fallbackWebhookUrl
	const alertChannel: AlertChannel | null =
		merged.alerts?.enabled === false || !webhookUrl
			? null
			: createWebhookChannel({
					...webhook,
					url: webhookUrl
				})
	const alertObserver = createSecurityAlertObserver({
		onAlert: async (alert) => {
			await merged.alerts?.onAlert?.(alert)
			if (alertChannel) {
				await alertChannel.send({
					severity: alert.severity === 'error' ? 'critical' : 'warning',
					title: 'Auth threshold exceeded',
					message: `${alert.eventName} exceeded ${alert.count} events`,
					source: 'goobits/auth',
					timestamp: alert.timestamp,
					context: { ...alert }
				})
			}
		}
	})
	const emitter = async (event: ReturnType<typeof createAuthEvent>): Promise<void> => {
		await merged.audit?.emitter?.(event)
		await alertObserver(event)
	}
	return {
		profile,
		csrf: {
			mode: merged.csrf?.mode ?? 'optional',
			externalBoundary: merged.csrf?.externalBoundary ?? false,
			cookieName: merged.csrf?.cookieName ?? CSRF_COOKIE_NAME,
			headerName: merged.csrf?.headerName ?? CSRF_HEADER_NAME,
			checkExpiry: merged.csrf?.checkExpiry ?? false,
			httpOnly: merged.csrf?.httpOnly ?? false,
			store: csrfStore
		},
		rateLimit: {
			mode: merged.rateLimit?.mode ?? 'optional',
			max: merged.rateLimit?.max ?? 20,
			windowMs: merged.rateLimit?.windowMs ?? 60_000,
			keyPrefix: merged.rateLimit?.keyPrefix ?? 'auth',
			trustProxyHeader: merged.rateLimit?.trustProxyHeader ?? false,
			trustedProxyHeaders: resolveTrustedProxyHeaders(merged.rateLimit),
			...(merged.rateLimit?.store ? { store: merged.rateLimit.store } : {})
		},
		audit: {
			mode: merged.audit?.mode ?? 'optional',
			emitter
		},
		routes: {
			'oauth.login': { csrf: 'off', rateLimit: 'optional' },
			'oauth.callback': { csrf: 'off', rateLimit: 'optional' },
			'auth.logout': { csrf: merged.csrf?.mode ?? 'optional' },
			'magic.request': { csrf: merged.csrf?.mode ?? 'optional' },
			'magic.verify': { csrf: merged.csrf?.mode ?? 'optional' },
			'webauthn.register.options': { csrf: merged.csrf?.mode ?? 'optional' },
			'webauthn.register.verify': { csrf: merged.csrf?.mode ?? 'optional' },
			'webauthn.login.options': { csrf: merged.csrf?.mode ?? 'optional' },
			'webauthn.login.verify': { csrf: merged.csrf?.mode ?? 'optional' },
			'mfa.status': { csrf: 'off' },
			'mfa.enroll': { csrf: merged.csrf?.mode ?? 'optional' },
			'mfa.verify': { csrf: merged.csrf?.mode ?? 'optional' },
			'mfa.disable': { csrf: merged.csrf?.mode ?? 'optional' },
			'mfa.backup_code': { csrf: merged.csrf?.mode ?? 'optional' },
			'sessions.list': { csrf: 'off' },
			'sessions.revoke': { csrf: merged.csrf?.mode ?? 'optional' }
		}
	}
}

export function applyPolicies(handlers: AuthHandlers, security: ResolvedSecurity): AuthHandlers {
	const wrapped: AuthHandlers = {
		...handlers,
		logout: applySecurityPolicy({
			handler: handlers.logout,
			routeId: 'auth.logout',
			settings: security
		})
	}
	if (handlers.login) {
		wrapped.login = applySecurityPolicy({
			handler: handlers.login,
			routeId: 'oauth.login',
			settings: security
		})
	}
	if (handlers.callback) {
		wrapped.callback = applySecurityPolicy({
			handler: handlers.callback,
			routeId: 'oauth.callback',
			settings: security
		})
	}
	if (handlers.magicLink) {
		wrapped.magicLink = {
			request: applySecurityPolicy({
				handler: handlers.magicLink.request,
				routeId: 'magic.request',
				settings: security
			}),
			verify: applySecurityPolicy({
				handler: handlers.magicLink.verify,
				routeId: 'magic.verify',
				settings: security
			})
		}
	}
	if (handlers.webauthn) {
		wrapped.webauthn = {
			registerOptions: applySecurityPolicy({
				handler: handlers.webauthn.registerOptions,
				routeId: 'webauthn.register.options',
				settings: security
			}),
			registerVerify: applySecurityPolicy({
				handler: handlers.webauthn.registerVerify,
				routeId: 'webauthn.register.verify',
				settings: security
			}),
			loginOptions: applySecurityPolicy({
				handler: handlers.webauthn.loginOptions,
				routeId: 'webauthn.login.options',
				settings: security
			}),
			loginVerify: applySecurityPolicy({
				handler: handlers.webauthn.loginVerify,
				routeId: 'webauthn.login.verify',
				settings: security
			})
		}
	}
	if (handlers.mfa) {
		wrapped.mfa = {
			status: applySecurityPolicy({
				handler: handlers.mfa.status,
				routeId: 'mfa.status',
				settings: security
			}),
			enroll: applySecurityPolicy({
				handler: handlers.mfa.enroll,
				routeId: 'mfa.enroll',
				settings: security
			}),
			verify: applySecurityPolicy({
				handler: handlers.mfa.verify,
				routeId: 'mfa.verify',
				settings: security
			}),
			disable: applySecurityPolicy({
				handler: handlers.mfa.disable,
				routeId: 'mfa.disable',
				settings: security
			}),
			backupCode: applySecurityPolicy({
				handler: handlers.mfa.backupCode,
				routeId: 'mfa.backup_code',
				settings: security
			})
		}
	}
	if (handlers.sessions) {
		wrapped.sessions = {
			list: applySecurityPolicy({
				handler: handlers.sessions.list,
				routeId: 'sessions.list',
				settings: security
			}),
			revoke: applySecurityPolicy({
				handler: handlers.sessions.revoke,
				routeId: 'sessions.revoke',
				settings: security
			})
		}
	}
	return wrapped
}
