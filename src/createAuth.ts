import { createLoginHandler } from "./handlers/login.ts";
import { createCallbackHandler } from "./handlers/callback.ts";
import { createLogoutHandler } from "./handlers/logout.ts";
import {
	createMagicLinkRequestHandler,
	createMagicLinkVerifyHandler,
} from "./handlers/magic-link.ts";
import {
	createWebAuthnRegisterOptionsHandler,
	createWebAuthnRegisterVerifyHandler,
	createWebAuthnLoginOptionsHandler,
	createWebAuthnLoginVerifyHandler,
	type WebAuthnLoginOptionsHandlerConfig,
	type WebAuthnLoginVerifyHandlerConfig,
	type WebAuthnRegisterOptionsHandlerConfig,
	type WebAuthnRegisterVerifyHandlerConfig,
} from "./handlers/webauthn.ts";
import {
	createSessionListHandler,
	createSessionRevokeHandler,
} from "./handlers/sessions.ts";
import type {
	AuthConfig,
	AuthHandlers,
	AuthLocals,
	AuthRoutes,
	OAuthProviderConfig,
	RequestEventLike,
} from "./types/auth.ts";
import { getLogger, setLogger } from "./utils/logger.ts";

/**
 * Create a complete authentication system with all handlers and hooks
 *
 * @param {Object} config - Authentication configuration
 * @param {Object} config.adapters - Adapter instances
 * @param {import('./adapters/session/base.ts').SessionAdapter} config.adapters.session - Session adapter
 * @param {import('./adapters/database/base.ts').DatabaseAdapter} [config.adapters.database] - Database adapter (optional)
 * @param {import('./adapters/token/base.ts').TokenAdapter} [config.adapters.token] - OAuth token adapter (optional)
 * @param {import('./utils/tokens.ts').VerificationTokenAdapter} [config.adapters.verificationTokens] - Verification token adapter (optional)
 * @param {Object.<string, {provider: import('./providers/base.ts').OAuthProvider, scopes?: string[]}>} config.providers - OAuth providers
 * @param {Object} [config.urls] - URL configuration
 * @param {string} [config.urls.login='/auth'] - Login page URL
 * @param {string} [config.urls.afterLogin='/'] - Redirect after successful login
 * @param {string} [config.urls.afterLogout='/'] - Redirect after logout
 * @param {Object} [config.cookies] - Cookie configuration
 * @param {boolean} [config.cookies.secure=true] - Use secure cookies
 * @param {Object} [config.hooks] - Lifecycle hooks
 * @param {Function} [config.hooks.onSessionValidated] - Called after session is validated (event, session, user)
 * @param {Function} [config.hooks.onLogin] - Called after successful login (event, profile, tokens)
 * @param {Function} [config.hooks.onLogout] - Called after logout (event)
 * @param {Function} [config.hooks.onError] - Called on authentication errors (event, error)
 * @param {boolean} [config.requireVerifiedEmailForLinking=true] - Only link by email when provider marks it verified
 * @param {Function} [config.isAuthenticated] - Custom authentication check (receives event.locals)
 * @returns {Object} Authentication system
 *
 * @example
 * // In src/lib/auth/index.ts
 * import { createAuth } from '@goobits/auth';
 * import { DrizzleSessionAdapter, DrizzleUserAdapter } from '@goobits/auth/adapters';
 * import { GoogleProvider, AppleProvider } from '@goobits/auth/providers';
 * import { db } from '$lib/db';
 * import { sessions, users } from '$lib/db/schema';
 *
 * export const auth = createAuth({
 *   adapters: {
 *     session: new DrizzleSessionAdapter(db, {
 *       sessionsTable: sessions,
 *       usersTable: users
 *     }),
 *     database: new DrizzleUserAdapter(db, { usersTable: users })
 *   },
 *   providers: {
 *     google: {
 *       provider: new GoogleProvider({
 *         clientId: env.GOOGLE_CLIENT_ID,
 *         clientSecret: env.GOOGLE_CLIENT_SECRET,
 *         callbackUrl: `${APP_URL}/auth/google/callback`
 *       }),
 *       scopes: ['openid', 'profile', 'email']
 *     }
 *   },
 *   urls: {
 *     afterLogin: '/dashboard',
 *     afterLogout: '/sign-in'
 *   },
 *   hooks: {
 *     onLogin: async (event, profile, tokens) => {
 *       // Find or create user
 *       let user = await db.getUserByEmail(profile.email);
 *       if (!user) {
 *         user = await db.createUser({ email: profile.email, ... });
 *       }
 *       // Create session
 *       await auth.adapters.session.createSession(user.id);
 *     }
 *   }
 * });
 *
 * // Use in routes:
 * // src/routes/auth/[provider]/+server.ts
 * export const GET = auth.handlers.login;
 *
 * // src/routes/auth/[provider]/callback/+server.ts
 * export const GET = auth.handlers.callback;
 *
 * // src/routes/logout/+page.server.ts
 * export const actions = auth.handlers.logout;
 */
export function createAuth(config: AuthConfig) {
	const {
		adapters,
		providers = {},
		urls = {},
		cookies = {},
		hooks = {},
		autoCreateSession = true,
		requireVerifiedEmailForLinking = true,
		isAuthenticated = (locals: AuthLocals) => !!locals.user,
		magicLink,
		webauthn,
		sessions,
		logger,
	} = config;

	setLogger(logger);
	const log = getLogger();

	// Validate required configuration
	if (!adapters.session) {
		throw new Error("createAuth requires adapters.session");
	}

	if (magicLink && !adapters.magicLink) {
		throw new Error("createAuth magicLink requires adapters.magicLink");
	}

	if (webauthn && !adapters.webauthn) {
		throw new Error("createAuth webauthn requires adapters.webauthn");
	}

	const hasProviders = providers && Object.keys(providers).length > 0;

	// Set defaults
	const urlConfig = {
		login: urls.login ?? "/auth",
		afterLogin: urls.afterLogin ?? "/",
		afterLogout: urls.afterLogout ?? "/",
	};

	const cookieConfig = {
		secure: cookies.secure ?? true,
	};

	// Create handlers
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

				if (adapters.database) {
					try {
						user = await adapters.database.getUserByProviderId(
							providerName,
							profile.id,
						);
					} catch {}

					const canLinkByEmail = profile.email
						? requireVerifiedEmailForLinking
							? profile.verified_email === true
							: true
						: false;

					if (!user && canLinkByEmail) {
						user = await adapters.database.getUserByEmail(profile.email);
					}

					if (!user) {
						user = await adapters.database.createUser(profile);
					}

					if (user && adapters.database.linkOAuthAccount) {
						try {
								await adapters.database.linkOAuthAccount(
									user.id,
									providerName,
									profile.id,
								);
						} catch {}
					}
				}

				let userId = user?.id ? String(user.id) : null;

				if (hooks.onLogin) {
					const hookResult = await hooks.onLogin(event, profile, tokens, user);
					if (hookResult?.userId) userId = String(hookResult.userId);
					if (hookResult?.id) userId = String(hookResult.id);
					if (hookResult?.user?.id) userId = String(hookResult.user.id);
				} else if (userId && adapters.session && autoCreateSession) {
					const session = await adapters.session.createSession(userId);
					if (adapters.session.setSessionCookie) {
						adapters.session.setSessionCookie(event.cookies, session);
					}
				}

				// Store tokens if adapter provided
				if (adapters.token) {
					if (!userId) {
						log.warn?.(
							"[auth] Token adapter enabled but no userId resolved. Falling back to provider profile id.",
						);
					}
						await adapters.token.storeTokens(
							userId ?? profile.id,
							providerName,
							tokens,
						);
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

	const logoutConfig: Parameters<typeof createLogoutHandler>[0] = {
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
	};
	const logoutHandler = createLogoutHandler(logoutConfig);

	// Create hooks server handler
	const handleHooks = async ({
		event,
		resolve,
	}: {
		event: RequestEventLike;
		resolve: (e: RequestEventLike) => Promise<Response>;
	}) => {
		const sessionCookieName =
			(adapters.session as { cookieName?: string }).cookieName ?? "session";
		const sessionId = event.cookies.get(sessionCookieName);

			if (sessionId) {
				const { session, user } = await adapters.session.validateSession(sessionId);

				event.locals.session = session;
				event.locals.user = user;

				if (session && user) {
					// Call user hook
					if (hooks.onSessionValidated) {
						await hooks.onSessionValidated(event, session, user);
					}

					// Refresh session cookie if needed
					if (session.fresh && adapters.session.setSessionCookie) {
						adapters.session.setSessionCookie(event.cookies, session);
					}
				} else if (adapters.session.deleteSessionCookie) {
					adapters.session.deleteSessionCookie(event.cookies);
				}
			} else {
				event.locals.session = null;
				event.locals.user = null;
			}

		return resolve(event);
	};

	const handlers: AuthHandlers = {
		logout: logoutHandler,
		hooks: handleHooks,
	};

	if (loginHandler) {
		handlers.login = loginHandler;
	}

	if (callbackHandler) {
		handlers.callback = callbackHandler;
	}

	if (magicLink) {
		const magicLinkOnLogin = magicLink.onLogin || hooks.onLogin;
		const requestConfig: Parameters<typeof createMagicLinkRequestHandler>[0] = {
			...magicLink,
			magicLinkAdapter: adapters.magicLink!,
			...(adapters.database ? { databaseAdapter: adapters.database } : {}),
		};
		const verifyConfig: Parameters<typeof createMagicLinkVerifyHandler>[0] = {
			...magicLink,
			magicLinkAdapter: adapters.magicLink!,
			sessionAdapter: adapters.session,
			redirectAfterLogin: urlConfig.afterLogin,
			secureCookies: cookieConfig.secure,
			onLogin: magicLinkOnLogin,
			isAuthenticated,
			...(adapters.database ? { databaseAdapter: adapters.database } : {}),
		};
		handlers.magicLink = {
				request: createMagicLinkRequestHandler(requestConfig),
				verify: createMagicLinkVerifyHandler(verifyConfig),
		};
	}

	if (webauthn) {
		const attestationType =
			webauthn.attestation === "indirect" ? "none" : webauthn.attestation;
		const registerOptionsConfig: WebAuthnRegisterOptionsHandlerConfig = {
			webauthnAdapter: adapters.webauthn!,
			rpID: webauthn.rpID ?? "",
			rpName: webauthn.rpName ?? "Passkey",
			attestationType,
			...(webauthn.timeoutMs ? { timeout: webauthn.timeoutMs } : {}),
			...(webauthn.userVerification
				? { userVerification: webauthn.userVerification }
				: {}),
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
			...(webauthn.userVerification
				? { userVerification: webauthn.userVerification }
				: {}),
			...(adapters.database ? { databaseAdapter: adapters.database } : {}),
		};
		const loginVerifyConfig: WebAuthnLoginVerifyHandlerConfig = {
			webauthnAdapter: adapters.webauthn!,
			sessionAdapter: adapters.session,
			rpID: webauthn.rpID ?? "",
			origin: webauthn.origin ?? "",
			redirectAfterLogin: urlConfig.afterLogin,
			requireUserVerification: webauthn.userVerification === "required",
			...(adapters.database ? { databaseAdapter: adapters.database } : {}),
		};
		const webauthnOnLogin = webauthn.onLogin || hooks.onLogin;
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

	const routes = {
		login: () => {
			if (!handlers.login) throw new Error("OAuth login handler not configured");
			return { GET: handlers.login };
		},
		callback: () => {
			if (!handlers.callback)
				throw new Error("OAuth callback handler not configured");
			return { GET: handlers.callback };
		},
		magicLink: () => {
			if (!handlers.magicLink)
				throw new Error("Magic link handlers not configured");
			return { POST: handlers.magicLink.request };
		},
		magicLinkVerify: () => {
			if (!handlers.magicLink)
				throw new Error("Magic link handlers not configured");
			return { GET: handlers.magicLink.verify, POST: handlers.magicLink.verify };
		},
		passkeyRegisterOptions: () => {
			if (!handlers.webauthn)
				throw new Error("WebAuthn handlers not configured");
			return { POST: handlers.webauthn.registerOptions };
		},
		passkeyRegisterVerify: () => {
			if (!handlers.webauthn)
				throw new Error("WebAuthn handlers not configured");
			return { POST: handlers.webauthn.registerVerify };
		},
		passkeyLoginOptions: () => {
			if (!handlers.webauthn)
				throw new Error("WebAuthn handlers not configured");
			return { POST: handlers.webauthn.loginOptions };
		},
		passkeyLoginVerify: () => {
			if (!handlers.webauthn)
				throw new Error("WebAuthn handlers not configured");
			return { POST: handlers.webauthn.loginVerify };
		},
		sessions: () => {
			if (!handlers.sessions)
				throw new Error("Session handlers not configured");
			return { GET: handlers.sessions.list, POST: handlers.sessions.revoke };
		},
	};

	return {
		adapters,
		providers,
		urls: urlConfig,
		cookies: cookieConfig,
		hooks,
		handlers,
		routes: routes as AuthRoutes,
		// Utility functions
		utils: {
			isAuthenticated: (locals: AuthLocals) => isAuthenticated(locals),
			getUser: (locals: AuthLocals) => locals.user,
			getSession: (locals: AuthLocals) => locals.session,
		},
	};
}
