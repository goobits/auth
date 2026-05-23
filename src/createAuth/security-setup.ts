import type {
	AuthConfig,
	AuthHandlers,
	AuthSecurityConfig,
	SecurityProfile,
} from "../types/auth.js";
import {
	MemoryCsrfStore,
	CSRF_COOKIE_NAME,
	CSRF_HEADER_NAME,
} from "../security/csrf.js";
import {
	applySecurityPolicy,
	type SecurityPolicySettings,
} from "../security/policy.js";
import { createSecurityAlertObserver } from "../security/alerts.js";
import { createWebhookAlerter } from "../security/alerting.js";
import { createAuthEvent } from "../security/events.js";

export type ResolvedSecurity = SecurityPolicySettings & {
	profile: SecurityProfile;
};

const PROFILE_DEFAULTS: Record<SecurityProfile, AuthSecurityConfig> = {
	basic: {
		csrf: { mode: "off" },
		rateLimit: { mode: "optional", max: 20, windowMs: 60_000, keyPrefix: "auth" },
		audit: { mode: "optional" },
	},
	secure: {
		csrf: { mode: "optional", checkExpiry: false },
		rateLimit: {
			mode: "required",
			max: 20,
			windowMs: 60_000,
			keyPrefix: "auth",
			trustProxyHeader: false,
		},
		audit: { mode: "required" },
		alerts: { enabled: true },
	},
	strict: {
		csrf: { mode: "required", checkExpiry: true },
		rateLimit: {
			mode: "required",
			max: 10,
			windowMs: 60_000,
			keyPrefix: "auth",
			trustProxyHeader: false,
		},
		audit: { mode: "required" },
		alerts: { enabled: true },
	},
};

export function resolveSecurity(config: AuthConfig): ResolvedSecurity {
	const profile = config.profile ?? "secure";
	const base = PROFILE_DEFAULTS[profile];
	const merged: AuthSecurityConfig = {
		csrf: { ...base.csrf, ...config.security?.csrf },
		rateLimit: { ...base.rateLimit, ...config.security?.rateLimit },
		audit: { ...base.audit, ...config.security?.audit },
		alerts: { ...base.alerts, ...config.security?.alerts },
	};
	const csrfStore = new MemoryCsrfStore();
	const webhook = merged.alerts?.webhook;
	const fallbackWebhookUrl =
		typeof process !== "undefined" ? process.env["SECURITY_WEBHOOK_URL"] : undefined;
	const fallbackWebhookSecret =
		typeof process !== "undefined" ? process.env["SECURITY_WEBHOOK_SECRET"] : undefined;
	const alerter =
		merged.alerts?.enabled === false
			? null
			: createWebhookAlerter({
					...webhook,
					url: webhook?.url ?? fallbackWebhookUrl ?? null,
					secret: webhook?.secret ?? fallbackWebhookSecret ?? null,
				});
	const alertObserver = createSecurityAlertObserver({
		onAlert: async (alert) => {
			await merged.alerts?.onAlert?.(alert);
			if (alerter) {
				await alerter({ ...alert }, "auth_threshold");
			}
		},
	});
	const emitter = async (event: ReturnType<typeof createAuthEvent>): Promise<void> => {
		await merged.audit?.emitter?.(event);
		await alertObserver(event);
	};
	return {
		profile,
		csrf: {
			mode: merged.csrf?.mode ?? "optional",
			cookieName: merged.csrf?.cookieName ?? CSRF_COOKIE_NAME,
			headerName: merged.csrf?.headerName ?? CSRF_HEADER_NAME,
			checkExpiry: merged.csrf?.checkExpiry ?? false,
			store: csrfStore,
		},
		rateLimit: {
			mode: merged.rateLimit?.mode ?? "optional",
			max: merged.rateLimit?.max ?? 20,
			windowMs: merged.rateLimit?.windowMs ?? 60_000,
			keyPrefix: merged.rateLimit?.keyPrefix ?? "auth",
			trustProxyHeader: merged.rateLimit?.trustProxyHeader ?? false,
			...(merged.rateLimit?.store ? { store: merged.rateLimit.store } : {}),
		},
		audit: {
			mode: merged.audit?.mode ?? "optional",
			emitter,
		},
		routes: {
			"oauth.login": { csrf: "off", rateLimit: "optional" },
			"oauth.callback": { csrf: "off", rateLimit: "optional" },
			"auth.logout": { csrf: merged.csrf?.mode ?? "optional" },
			"magic.request": { csrf: merged.csrf?.mode ?? "optional" },
			"magic.verify": { csrf: merged.csrf?.mode ?? "optional" },
			"webauthn.register.options": { csrf: merged.csrf?.mode ?? "optional" },
			"webauthn.register.verify": { csrf: merged.csrf?.mode ?? "optional" },
			"webauthn.login.options": { csrf: merged.csrf?.mode ?? "optional" },
			"webauthn.login.verify": { csrf: merged.csrf?.mode ?? "optional" },
			"sessions.list": { csrf: "off" },
			"sessions.revoke": { csrf: merged.csrf?.mode ?? "optional" },
		},
	};
}

export function applyPolicies(
	handlers: AuthHandlers,
	security: ResolvedSecurity,
): AuthHandlers {
	const wrapped: AuthHandlers = {
		...handlers,
		logout: applySecurityPolicy({
			handler: handlers.logout,
			routeId: "auth.logout",
			settings: security,
		}),
	};
	if (handlers.login) {
		wrapped.login = applySecurityPolicy({
			handler: handlers.login,
			routeId: "oauth.login",
			settings: security,
		});
	}
	if (handlers.callback) {
		wrapped.callback = applySecurityPolicy({
			handler: handlers.callback,
			routeId: "oauth.callback",
			settings: security,
		});
	}
	if (handlers.magicLink) {
		wrapped.magicLink = {
			request: applySecurityPolicy({
				handler: handlers.magicLink.request,
				routeId: "magic.request",
				settings: security,
			}),
			verify: applySecurityPolicy({
				handler: handlers.magicLink.verify,
				routeId: "magic.verify",
				settings: security,
			}),
		};
	}
	if (handlers.webauthn) {
		wrapped.webauthn = {
			registerOptions: applySecurityPolicy({
				handler: handlers.webauthn.registerOptions,
				routeId: "webauthn.register.options",
				settings: security,
			}),
			registerVerify: applySecurityPolicy({
				handler: handlers.webauthn.registerVerify,
				routeId: "webauthn.register.verify",
				settings: security,
			}),
			loginOptions: applySecurityPolicy({
				handler: handlers.webauthn.loginOptions,
				routeId: "webauthn.login.options",
				settings: security,
			}),
			loginVerify: applySecurityPolicy({
				handler: handlers.webauthn.loginVerify,
				routeId: "webauthn.login.verify",
				settings: security,
			}),
		};
	}
	if (handlers.sessions) {
		wrapped.sessions = {
			list: applySecurityPolicy({
				handler: handlers.sessions.list,
				routeId: "sessions.list",
				settings: security,
			}),
			revoke: applySecurityPolicy({
				handler: handlers.sessions.revoke,
				routeId: "sessions.revoke",
				settings: security,
			}),
		};
	}
	return wrapped;
}
