import { createLoginHandler } from "./handlers/login.js";
import { createCallbackHandler } from "./handlers/callback.js";
import { createLogoutHandler } from "./handlers/logout.js";
import {
	createMagicLinkRequestHandler,
	createMagicLinkVerifyHandler,
} from "./handlers/magic-link.js";
import {
	createWebAuthnRegisterOptionsHandler,
	createWebAuthnRegisterVerifyHandler,
	createWebAuthnLoginOptionsHandler,
	createWebAuthnLoginVerifyHandler,
	type WebAuthnLoginOptionsHandlerConfig,
	type WebAuthnLoginVerifyHandlerConfig,
	type WebAuthnRegisterOptionsHandlerConfig,
	type WebAuthnRegisterVerifyHandlerConfig,
} from "./handlers/webauthn.js";
import {
	createSessionListHandler,
	createSessionRevokeHandler,
} from "./handlers/sessions.js";
import type {
	AuthConfig,
	AuthHandlers,
	AuthLocals,
	AuthLoginResult,
	AuthRoutes,
	AuthSecurityConfig,
	MagicLinkConfig,
	OnLoginMode,
	OAuthProviderConfig,
	RequestEventLike,
	SecurityProfile,
} from "./types/auth.js";
import type { User } from "./types/index.js";
import { getLogger, setLogger } from "./utils/logger.js";
import { ensureSessionAfterLogin } from "./utils/session-lifecycle.js";
import { MemoryCsrfStore, CSRF_COOKIE_NAME, CSRF_HEADER_NAME, issueCsrfToken } from "./security/csrf.js";
import { applySecurityPolicy, type SecurityPolicySettings } from "./security/policy.js";
import { createSecurityAlertObserver } from "./security/alerts.js";
import { createWebhookAlerter } from "./security/alerting.js";
import { createAuthEvent } from "./security/events.js";

type ResolvedDefaults = {
	urlConfig: {
		login: string;
		afterLogin: string;
		afterLogout: string;
	};
	cookieConfig: {
		secure: boolean;
	};
	autoCreateSession: boolean;
	requireVerifiedEmailForLinking: boolean;
	isAuthenticated: (locals: AuthLocals) => boolean;
};

type ResolvedSecurity = SecurityPolicySettings & {
	profile: SecurityProfile;
};

function validateConfig(config: AuthConfig): void {
	if (!config.adapters.session) {
		throw new Error("createAuth requires adapters.session");
	}
	if (config.magicLink && !config.adapters.magicLink) {
		throw new Error("createAuth magicLink requires adapters.magicLink");
	}
	if (config.webauthn && !config.adapters.webauthn) {
		throw new Error("createAuth webauthn requires adapters.webauthn");
	}
}

function resolveDefaults(config: AuthConfig): ResolvedDefaults {
	return {
		urlConfig: {
			login: config.urls?.login ?? "/auth",
			afterLogin: config.urls?.afterLogin ?? "/",
			afterLogout: config.urls?.afterLogout ?? "/",
		},
		cookieConfig: {
			secure: config.cookies?.secure ?? true,
		},
		autoCreateSession: config.autoCreateSession ?? true,
		requireVerifiedEmailForLinking: config.requireVerifiedEmailForLinking ?? true,
		isAuthenticated: config.isAuthenticated ?? ((locals: AuthLocals) => !!locals.user),
	};
}

function resolveSecurity(config: AuthConfig): ResolvedSecurity {
	const profile = config.profile ?? "secure";
	const secureDefaults: Record<SecurityProfile, AuthSecurityConfig> = {
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
	const base = secureDefaults[profile];
	const merged: AuthSecurityConfig = {
		csrf: { ...base.csrf, ...config.security?.csrf },
		rateLimit: { ...base.rateLimit, ...config.security?.rateLimit },
		audit: { ...base.audit, ...config.security?.audit },
		alerts: { ...base.alerts, ...config.security?.alerts },
	};
	const csrfStore = new MemoryCsrfStore();
	const webhookUrl =
		typeof process !== "undefined" ? process.env["SECURITY_WEBHOOK_URL"] : undefined;
	const webhookSecret =
		typeof process !== "undefined" ? process.env["SECURITY_WEBHOOK_SECRET"] : undefined;
	const alerter =
		merged.alerts?.enabled === false
			? null
			: createWebhookAlerter({
					url: webhookUrl ?? null,
					secret: webhookSecret ?? null,
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

function applyPolicies(
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

function resolveOnLoginUserId(
	hookResult: AuthLoginResult,
	fallbackUserId: string | null,
): string | null {
	if (hookResult && typeof hookResult === "object" && hookResult["userId"]) {
		return String(hookResult["userId"]);
	}
	return fallbackUserId;
}

function normalizeMagicLinkConfig(
	magicLink: MagicLinkConfig,
	globalHooks: AuthConfig["hooks"],
	defaultSecureCookies: boolean,
) {
	const settings = magicLink.settings ?? {};
	const limits = magicLink.limits ?? {};
	const hooks = magicLink.hooks ?? {};
	const normalized = {
		sendEmail: magicLink.send.email,
		secureCookies: settings.secureCookies ?? defaultSecureCookies,
		...(settings.allowSignup !== undefined ? { allowSignup: settings.allowSignup } : {}),
		...(settings.expiresInMs !== undefined ? { expiresInMs: settings.expiresInMs } : {}),
		...(settings.magicLinkPath !== undefined ? { magicLinkPath: settings.magicLinkPath } : {}),
		...(settings.includeOtp !== undefined ? { includeOtp: settings.includeOtp } : {}),
		...(settings.otpDigits !== undefined ? { otpDigits: settings.otpDigits } : {}),
		...(settings.singleUsePerEmail !== undefined
			? { singleUsePerEmail: settings.singleUsePerEmail }
			: {}),
		...(settings.normalizeEmail !== undefined ? { normalizeEmail: settings.normalizeEmail } : {}),
		...(settings.exposeToken !== undefined ? { exposeToken: settings.exposeToken } : {}),
		...(settings.baseUrl !== undefined ? { baseUrl: settings.baseUrl } : {}),
		...(limits.request !== undefined ? { rateLimit: limits.request } : {}),
		...(limits.verify !== undefined ? { verifyRateLimit: limits.verify } : {}),
		...(limits.verifyMax !== undefined ? { verifyRateLimitMax: limits.verifyMax } : {}),
		...(limits.verifyWindowMs !== undefined
			? { verifyRateLimitWindowMs: limits.verifyWindowMs }
			: {}),
		...(hooks.getMetadata !== undefined ? { getMetadata: hooks.getMetadata } : {}),
		...(hooks.createUser !== undefined ? { createUser: hooks.createUser } : {}),
		...(hooks.sanitizeUser !== undefined ? { sanitizeUser: hooks.sanitizeUser } : {}),
		...(settings.trustProxyHeader !== undefined
			? { trustProxyHeader: settings.trustProxyHeader }
			: {}),
		...(settings.key !== undefined ? { key: settings.key } : {}),
	};
	const onLogin = hooks.onLogin ?? globalHooks?.onLogin;
	return onLogin ? { ...normalized, onLogin } : normalized;
}

function createHandlers(
	config: AuthConfig,
	defaults: ResolvedDefaults,
	security: ResolvedSecurity,
): AuthHandlers {
	const {
		adapters,
		providers = {},
		hooks = {},
		magicLink,
		webauthn,
		sessions,
		sanitizeUser = (user: User | null) => user,
	} = config;
	const { urlConfig, cookieConfig, autoCreateSession, requireVerifiedEmailForLinking, isAuthenticated } =
		defaults;
	const onLoginMode: OnLoginMode = hooks.onLoginMode ?? "augment";
	const log = getLogger();
	const hasProviders = Object.keys(providers).length > 0;
	let loginHandler: AuthHandlers["login"];
	let callbackHandler: AuthHandlers["callback"];

	if (hasProviders) {
		loginHandler = createLoginHandler({
			providers,
			redirectAfterLogin: urlConfig.afterLogin,
			secureCookies: cookieConfig.secure,
			isAuthenticated,
		});

		const callbackConfig: Parameters<typeof createCallbackHandler>[0] = {
			providers: Object.fromEntries(
				Object.entries(providers as Record<string, OAuthProviderConfig>).map(
					([name, providerConfig]) => [name, providerConfig.provider],
				),
			),
			redirectAfterLogin: urlConfig.afterLogin,
			isAuthenticated,
			onAuthenticated: async (event, profile, tokens) => {
				const providerName = String(event.params["provider"] ?? "");
				let user = null;

				if (adapters.user) {
					try {
						user = await adapters.user.getUserByProviderId(providerName, profile.id);
					} catch {
						user = null;
					}

					const canLinkByEmail = profile.email
						? requireVerifiedEmailForLinking
							? profile.verified_email === true
							: true
						: false;
					if (!user && canLinkByEmail) {
						user = await adapters.user.getUserByEmail(profile.email);
					}
					if (!user) {
						user = await adapters.user.createUser(profile);
					}
					if (user && adapters.user.linkOAuthAccount) {
						try {
							await adapters.user.linkOAuthAccount(user.id, providerName, profile.id);
						} catch {
							// ignore duplicate link failures
						}
					}
				}

				let userId = user?.id ? String(user.id) : null;
				if (hooks.onLogin) {
					const hookResult = await hooks.onLogin(event, profile, tokens, user);
					userId = resolveOnLoginUserId(hookResult, userId);
				}
				userId = await ensureSessionAfterLogin({
					event,
					sessionAdapter: adapters.session,
					userId,
					autoCreateSession,
					onLoginMode,
				});

				if (adapters.oauthToken) {
					await adapters.oauthToken.storeTokens(userId, providerName, tokens);
				}
			},
			...(hooks.onError
				? {
						onError: async (event: RequestEventLike, error: unknown) => {
							await hooks.onError?.(event, error);
						},
					}
				: {}),
		};
		callbackHandler = createCallbackHandler(callbackConfig);
	}

	const logoutHandler = createLogoutHandler({
		sessionAdapter: adapters.session,
		redirectAfterLogout: urlConfig.afterLogout,
		getSession: (locals: AuthLocals) => locals.session ?? null,
		...(hooks.onLogout
			? {
					onLogout: async (event: RequestEventLike) => {
						await hooks.onLogout?.(event);
					},
				}
			: {}),
	});

	const handleHooks: AuthHandlers["hooks"] = async ({ event, resolve }) => {
		const method = event.request.method.toUpperCase();
		const safeMethod = method === "GET" || method === "HEAD" || method === "OPTIONS";
		if (safeMethod && security.csrf.mode !== "off") {
			const existingToken = event.cookies.get(security.csrf.cookieName);
			if (!existingToken) {
				await issueCsrfToken({
					cookies: event.cookies,
					cookieName: security.csrf.cookieName,
					secure: defaults.cookieConfig.secure,
					...(security.csrf.store ? { store: security.csrf.store } : {}),
				});
			}
		}
		const sessionCookieName =
			(adapters.session as { cookieName?: string })["cookieName"] ?? "session";
		const sessionId = event.cookies.get(sessionCookieName);
		if (!sessionId) {
			event.locals.session = null;
			event.locals.user = null;
			return resolve(event);
		}
		const { session, user } = await adapters.session.validateSession(sessionId);
		event.locals.session = session;
		event.locals.user = sanitizeUser(user);
		if (session && user) {
			if (hooks.onSessionValidated) {
				await hooks.onSessionValidated(event, session, user);
			}
			if (session.fresh) {
				adapters.session.setSessionCookie?.(event.cookies, session);
			}
		} else {
			adapters.session.deleteSessionCookie?.(event.cookies);
		}
		return resolve(event);
	};

	const handlers: AuthHandlers = {
		logout: logoutHandler,
		hooks: handleHooks,
	};
	if (loginHandler) handlers.login = loginHandler;
	if (callbackHandler) handlers.callback = callbackHandler;

	if (magicLink) {
		const normalizedMagicLink = normalizeMagicLinkConfig(
			magicLink,
			hooks,
			cookieConfig.secure,
		);
		const requestConfig: Parameters<typeof createMagicLinkRequestHandler>[0] = {
			...normalizedMagicLink,
			magicLinkAdapter: adapters.magicLink!,
			...(adapters.user ? { databaseAdapter: adapters.user } : {}),
		};
		const verifyConfig: Parameters<typeof createMagicLinkVerifyHandler>[0] = {
			...normalizedMagicLink,
			magicLinkAdapter: adapters.magicLink!,
			sessionAdapter: adapters.session,
			autoCreateSession,
			onLoginMode,
			redirectAfterLogin: urlConfig.afterLogin,
			isAuthenticated,
			...(normalizedMagicLink["sanitizeUser"] === undefined
				? { sanitizeUser }
				: {}),
			...(adapters.user ? { databaseAdapter: adapters.user } : {}),
		};
		handlers.magicLink = {
			request: createMagicLinkRequestHandler(requestConfig),
			verify: createMagicLinkVerifyHandler(verifyConfig),
		};
	}

	if (webauthn) {
		const attestationType = webauthn.attestation === "indirect" ? "none" : webauthn.attestation;
		const registerOptionsConfig: WebAuthnRegisterOptionsHandlerConfig = {
			webauthnAdapter: adapters.webauthn!,
			rpID: webauthn.rpID ?? "",
			rpName: webauthn.rpName ?? "Passkey",
			attestationType,
			...(webauthn.timeoutMs ? { timeout: webauthn.timeoutMs } : {}),
			...(webauthn.userVerification ? { userVerification: webauthn.userVerification } : {}),
		};
		const registerVerifyConfig: WebAuthnRegisterVerifyHandlerConfig = {
			webauthnAdapter: adapters.webauthn!,
			rpID: webauthn.rpID ?? "",
			origin: webauthn.origin ?? "",
			requireUserVerification: webauthn.userVerification === "required",
		};
		const loginOptionsConfig: WebAuthnLoginOptionsHandlerConfig = {
			webauthnAdapter: adapters.webauthn!,
			rpID: webauthn.rpID ?? "",
			...(webauthn.timeoutMs ? { timeout: webauthn.timeoutMs } : {}),
			...(webauthn.userVerification ? { userVerification: webauthn.userVerification } : {}),
			...(adapters.user ? { databaseAdapter: adapters.user } : {}),
		};
		const loginVerifyConfig: WebAuthnLoginVerifyHandlerConfig = {
			webauthnAdapter: adapters.webauthn!,
			sessionAdapter: adapters.session,
			rpID: webauthn.rpID ?? "",
			origin: webauthn.origin ?? "",
			redirectAfterLogin: urlConfig.afterLogin,
			requireUserVerification: webauthn.userVerification === "required",
			autoCreateSession,
			onLoginMode,
			sanitizeUser,
			...(adapters.user ? { databaseAdapter: adapters.user } : {}),
		};
		const webauthnOnLogin = webauthn.hooks?.onLogin ?? hooks.onLogin;
		if (webauthnOnLogin) {
			loginVerifyConfig.onLogin = webauthnOnLogin;
		}
		handlers.webauthn = {
			registerOptions: createWebAuthnRegisterOptionsHandler(registerOptionsConfig),
			registerVerify: createWebAuthnRegisterVerifyHandler(registerVerifyConfig),
			loginOptions: createWebAuthnLoginOptionsHandler(loginOptionsConfig),
			loginVerify: createWebAuthnLoginVerifyHandler(loginVerifyConfig),
		};
	}

	if (sessions) {
		handlers.sessions = {
			list: createSessionListHandler({
				...sessions,
				sessionAdapter: adapters.session,
				isAuthenticated,
			}),
			revoke: createSessionRevokeHandler({
				...sessions,
				sessionAdapter: adapters.session,
				isAuthenticated,
			}),
		};
	}

	return handlers;
}

function buildRoutes(handlers: AuthHandlers): AuthRoutes {
	return {
		login: () => {
			if (!handlers.login) throw new Error("OAuth login handler not configured");
			return { GET: handlers.login };
		},
		callback: () => {
			if (!handlers.callback) throw new Error("OAuth callback handler not configured");
			return { GET: handlers.callback };
		},
		logout: () => ({ POST: handlers.logout }),
		magicLink: () => {
			if (!handlers.magicLink) throw new Error("Magic link handlers not configured");
			return { POST: handlers.magicLink.request };
		},
		magicLinkVerify: () => {
			if (!handlers.magicLink) throw new Error("Magic link handlers not configured");
			return { GET: handlers.magicLink.verify, POST: handlers.magicLink.verify };
		},
		passkeyRegisterOptions: () => {
			if (!handlers.webauthn) throw new Error("WebAuthn handlers not configured");
			return { POST: handlers.webauthn.registerOptions };
		},
		passkeyRegisterVerify: () => {
			if (!handlers.webauthn) throw new Error("WebAuthn handlers not configured");
			return { POST: handlers.webauthn.registerVerify };
		},
		passkeyLoginOptions: () => {
			if (!handlers.webauthn) throw new Error("WebAuthn handlers not configured");
			return { POST: handlers.webauthn.loginOptions };
		},
		passkeyLoginVerify: () => {
			if (!handlers.webauthn) throw new Error("WebAuthn handlers not configured");
			return { POST: handlers.webauthn.loginVerify };
		},
		sessions: () => {
			if (!handlers.sessions) throw new Error("Session handlers not configured");
			return { GET: handlers.sessions.list, POST: handlers.sessions.revoke };
		},
	};
}

function createUtils(isAuthenticated: (locals: AuthLocals) => boolean) {
	return {
		isAuthenticated: (locals: AuthLocals) => isAuthenticated(locals),
		getUser: (locals: AuthLocals) => locals.user,
		getSession: (locals: AuthLocals) => locals.session,
	};
}

export function createAuth(config: AuthConfig) {
	setLogger(config.logger);
	validateConfig(config);
	const defaults = resolveDefaults(config);
	const security = resolveSecurity(config);
	const handlers = applyPolicies(createHandlers(config, defaults, security), security);
	const routes = buildRoutes(handlers);
	return {
		adapters: config.adapters,
		providers: config.providers ?? {},
		urls: defaults.urlConfig,
		cookies: defaults.cookieConfig,
		profile: security.profile,
		security,
		hooks: config.hooks ?? {},
		handlers,
		routes,
		utils: createUtils(defaults.isAuthenticated),
	};
}
