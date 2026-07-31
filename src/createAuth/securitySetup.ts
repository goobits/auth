import { createWebhookChannel, type AlertChannel } from '@goobits/security/alerting'
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME, MemoryCsrfStore } from '@goobits/security/csrf'
import { isProductionRuntime } from '@goobits/security/runtime'
import { createSecurityAlertObserver } from '../security/alerts.ts'
import { createAuthEvent } from '../security/events.ts'
import { applySecurityPolicy, type SecurityPolicySettings } from '../security/policy.ts'
import { getAuthRateLimitWindows } from '../security/rateLimit.ts'
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
		rateLimit: {
			mode: 'optional',
			windows: getAuthRateLimitWindows('default'),
			keyPrefix: 'auth'
		},
		audit: { mode: 'optional' }
	},
	secure: {
		csrf: { mode: 'required', checkExpiry: false },
		rateLimit: { mode: 'required', windows: getAuthRateLimitWindows('login'), keyPrefix: 'auth' },
		audit: { mode: 'required' },
		alerts: { enabled: true }
	},
	strict: {
		csrf: { mode: 'required', checkExpiry: true },
		rateLimit: { mode: 'required', windows: getAuthRateLimitWindows('login'), keyPrefix: 'auth' },
		audit: { mode: 'required' },
		alerts: { enabled: true }
	}
}

const TRUSTED_PROXY_HEADERS = new Set<TrustedProxyHeader>(['cf-connecting-ip', 'x-forwarded-for'])

function resolveTrustedProxyHeaders(
	rateLimit: AuthSecurityConfig['rateLimit']
): TrustedProxyHeader[] {
	return Array.from(
		new Set(
			(rateLimit?.trustedProxyHeaders ?? []).filter((header) => TRUSTED_PROXY_HEADERS.has(header))
		)
	)
}

function resolveForwardedForTrustedProxyHops(
	rateLimit: AuthSecurityConfig['rateLimit']
): number | undefined {
	const hops = rateLimit?.forwardedForTrustedProxyHops
	if (hops === undefined) return undefined
	if (!Number.isSafeInteger(hops) || hops <= 0) {
		throw new Error('forwardedForTrustedProxyHops must be a positive safe integer')
	}
	return hops
}

function resolveRateLimitWindows(
	base: AuthSecurityConfig['rateLimit'],
	override: AuthSecurityConfig['rateLimit']
) {
	if (override?.windows) return override.windows.map((window) => ({ ...window }))
	if (override?.max !== undefined || override?.windowMs !== undefined) {
		const fallback = base?.windows?.[0] ?? getAuthRateLimitWindows('login')[0]
		if (!fallback) throw new Error('Auth rate-limit policy requires at least one window')
		return [
			{
				name: 'auth:custom',
				maxEvents: override.max ?? fallback.maxEvents,
				windowMs: override.windowMs ?? fallback.windowMs
			}
		]
	}
	return (base?.windows ?? getAuthRateLimitWindows('login')).map((window) => ({ ...window }))
}

function assertProfileRequirements(profile: SecurityProfile, security: AuthSecurityConfig): void {
	if (profile === 'basic') return
	const csrfMode = security.csrf?.mode ?? 'required'
	const externalCsrfBoundary = security.csrf?.validateExternalSecurityBoundary

	if (profile === 'strict' && (csrfMode !== 'required' || externalCsrfBoundary)) {
		throw new Error('The strict auth profile requires built-in CSRF protection')
	}
	if (
		profile === 'secure' &&
		csrfMode !== 'required' &&
		!(csrfMode === 'off' && externalCsrfBoundary)
	) {
		throw new Error(
			"The secure auth profile requires CSRF protection or csrf.validateExternalSecurityBoundary with mode 'off'"
		)
	}
	if (externalCsrfBoundary && csrfMode !== 'off') {
		throw new Error("csrf.validateExternalSecurityBoundary may only be used with csrf.mode 'off'")
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
	if (
		security.audit?.mode === 'required' &&
		(profile === 'strict' || isProductionRuntime()) &&
		!security.audit.emitter
	) {
		throw new Error(`${profile} auth profile requires an explicit audit emitter`)
	}
}

export function resolveSecurity(config: AuthConfig): ResolvedSecurity {
	const profile = config.profile ?? 'secure'
	const base = PROFILE_DEFAULTS[profile]
	const rateLimitWindows = resolveRateLimitWindows(base.rateLimit, config.security?.rateLimit)
	const hasCustomRateLimitWindows = Boolean(
		config.security?.rateLimit?.windows ||
		config.security?.rateLimit?.max !== undefined ||
		config.security?.rateLimit?.windowMs !== undefined
	)
	const flowWindows = (flow: Parameters<typeof getAuthRateLimitWindows>[0]) =>
		hasCustomRateLimitWindows ? rateLimitWindows : getAuthRateLimitWindows(flow)
	const merged: AuthSecurityConfig = {
		csrf: { ...base.csrf, ...config.security?.csrf },
		rateLimit: { ...base.rateLimit, ...config.security?.rateLimit },
		audit: { ...base.audit, ...config.security?.audit },
		alerts: { ...base.alerts, ...config.security?.alerts }
	}
	assertProfileRequirements(profile, merged)
	if (config.magicLink && isProductionRuntime() && !merged.rateLimit?.store) {
		throw new Error('Production magic-link auth requires a shared rate-limit store')
	}
	if (config.magicLink && isProductionRuntime() && !merged.audit?.emitter) {
		throw new Error('Production magic-link auth requires an explicit audit emitter')
	}
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
					url: webhookUrl,
					...(webhook?.logger || config.logger ? { logger: webhook?.logger ?? config.logger } : {})
				})
	const alertObserver = createSecurityAlertObserver({
		...(merged.alerts?.rules ? { rules: merged.alerts.rules } : {}),
		...(merged.alerts?.store ? { store: merged.alerts.store } : {}),
		...(merged.alerts?.keyPrefix ? { keyPrefix: merged.alerts.keyPrefix } : {}),
		onAlert: async (alert) => {
			await merged.alerts?.onAlert?.(alert)
			if (alertChannel) {
				await alertChannel.send({
					severity: alert.severity,
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
	const forwardedForTrustedProxyHops = resolveForwardedForTrustedProxyHops(merged.rateLimit)
	return {
		profile,
		csrf: {
			mode: merged.csrf?.mode ?? 'optional',
			...(merged.csrf?.validateExternalSecurityBoundary
				? {
						validateExternalSecurityBoundary: merged.csrf.validateExternalSecurityBoundary
					}
				: {}),
			cookieName: merged.csrf?.cookieName ?? CSRF_COOKIE_NAME,
			headerName: merged.csrf?.headerName ?? CSRF_HEADER_NAME,
			checkExpiry: merged.csrf?.checkExpiry ?? false,
			httpOnly: merged.csrf?.httpOnly ?? false,
			store: csrfStore
		},
		rateLimit: {
			mode: merged.rateLimit?.mode ?? 'optional',
			windows: rateLimitWindows,
			keyPrefix: merged.rateLimit?.keyPrefix ?? 'auth',
			trustedProxyHeaders: resolveTrustedProxyHeaders(merged.rateLimit),
			...(forwardedForTrustedProxyHops !== undefined
				? { forwardedForTrustedProxyHops }
				: {}),
			...(config.logger ? { logger: config.logger } : {}),
			...(merged.rateLimit?.store ? { store: merged.rateLimit.store } : {})
		},
		audit: {
			mode: merged.audit?.mode ?? 'optional',
			emitter
		},
		routes: {
			'oauth.login': {
				csrf: 'off',
				rateLimit: 'optional',
				rateLimitWindows: flowWindows('login')
			},
			'oauth.callback': {
				csrf: 'off',
				rateLimit: 'optional',
				rateLimitWindows: flowWindows('default')
			},
			'auth.logout': {
				csrf: merged.csrf?.mode ?? 'optional',
				rateLimitWindows: flowWindows('default')
			},
			'magic.request': {
				csrf: merged.csrf?.mode ?? 'optional',
				rateLimitWindows: flowWindows('password-reset')
			},
			'magic.verify': {
				csrf: merged.csrf?.mode ?? 'optional',
				rateLimitWindows: flowWindows('login')
			},
			'webauthn.register.options': {
				csrf: merged.csrf?.mode ?? 'optional',
				rateLimitWindows: flowWindows('registration')
			},
			'webauthn.register.verify': {
				csrf: merged.csrf?.mode ?? 'optional',
				rateLimitWindows: flowWindows('registration')
			},
			'webauthn.login.options': {
				csrf: merged.csrf?.mode ?? 'optional',
				rateLimitWindows: flowWindows('login')
			},
			'webauthn.login.verify': {
				csrf: merged.csrf?.mode ?? 'optional',
				rateLimitWindows: flowWindows('login')
			},
			'webauthn.credentials.list': {
				csrf: 'off',
				rateLimitWindows: flowWindows('default')
			},
			'webauthn.credentials.remove': {
				csrf: merged.csrf?.mode ?? 'optional',
				rateLimitWindows: flowWindows('default')
			},
			'webauthn.step_up.options': {
				csrf: merged.csrf?.mode ?? 'optional',
				rateLimitWindows: flowWindows('login')
			},
			'webauthn.step_up.verify': {
				csrf: merged.csrf?.mode ?? 'optional',
				rateLimitWindows: flowWindows('login')
			},
			'mfa.status': { csrf: 'off', rateLimitWindows: flowWindows('default') },
			'mfa.enroll': {
				csrf: merged.csrf?.mode ?? 'optional',
				rateLimitWindows: flowWindows('registration')
			},
			'mfa.verify': {
				csrf: merged.csrf?.mode ?? 'optional',
				rateLimitWindows: flowWindows('login')
			},
			'mfa.disable': {
				csrf: merged.csrf?.mode ?? 'optional',
				rateLimitWindows: flowWindows('default')
			},
			'mfa.backup_code': {
				csrf: merged.csrf?.mode ?? 'optional',
				rateLimitWindows: flowWindows('login')
			},
			'mfa.step_up': {
				csrf: merged.csrf?.mode ?? 'optional',
				rateLimitWindows: flowWindows('login')
			},
			'sessions.list': { csrf: 'off', rateLimitWindows: flowWindows('default') },
			'sessions.revoke': {
				csrf: merged.csrf?.mode ?? 'optional',
				rateLimitWindows: flowWindows('default')
			}
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
			}),
			listCredentials: applySecurityPolicy({
				handler: handlers.webauthn.listCredentials,
				routeId: 'webauthn.credentials.list',
				settings: security
			}),
			removeCredential: applySecurityPolicy({
				handler: handlers.webauthn.removeCredential,
				routeId: 'webauthn.credentials.remove',
				settings: security
			}),
			stepUpOptions: applySecurityPolicy({
				handler: handlers.webauthn.stepUpOptions,
				routeId: 'webauthn.step_up.options',
				settings: security
			}),
			stepUpVerify: applySecurityPolicy({
				handler: handlers.webauthn.stepUpVerify,
				routeId: 'webauthn.step_up.verify',
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
			}),
			stepUp: applySecurityPolicy({
				handler: handlers.mfa.stepUp,
				routeId: 'mfa.step_up',
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
