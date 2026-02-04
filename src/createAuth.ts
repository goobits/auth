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
} from "./handlers/webauthn.ts";
import {
	createSessionListHandler,
	createSessionRevokeHandler,
} from "./handlers/sessions.ts";

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
export function createAuth(config: any) {
	const {
		adapters,
		providers = {},
		urls = {},
		cookies = {},
		hooks = {},
		autoCreateSession = true,
		requireVerifiedEmailForLinking = true,
		isAuthenticated = (locals: any) => !!locals.user,
		magicLink,
		webauthn,
		sessions,
	} = config;

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
	let loginHandler;
	let callbackHandler;

	if (hasProviders) {
		loginHandler = createLoginHandler({
			providers,
			redirectAfterLogin: urlConfig.afterLogin,
			secureCookies: cookieConfig.secure,
			isAuthenticated,
		});

		callbackHandler = createCallbackHandler({
			providers: Object.fromEntries(
				Object.entries(providers as Record<string, any>).map(([name, config]) => [
					name,
					(config as any).provider,
				]),
			),
			redirectAfterLogin: urlConfig.afterLogin,
			isAuthenticated,
			onAuthenticated: async (event, profile, tokens) => {
				const profileData = profile as any;
				const providerName = event.params.provider;
				let user = null;

				if (adapters.database) {
					try {
						user = await adapters.database.getUserByProviderId(
							providerName,
							profileData.id,
						);
					} catch {}

					const canLinkByEmail = profileData.email
						? requireVerifiedEmailForLinking
							? profileData.verified_email === true
							: true
						: false;

					if (!user && canLinkByEmail) {
						user = await adapters.database.getUserByEmail(profileData.email);
					}

					if (!user) {
						user = await adapters.database.createUser(profileData);
					}

					if (user && adapters.database.linkOAuthAccount) {
						try {
								await adapters.database.linkOAuthAccount(
									user.id,
									providerName,
									profileData.id,
								);
						} catch {}
					}
				}

				let userId = user?.id ?? null;

					if (hooks.onLogin) {
						const hookResult = await hooks.onLogin(
							event,
							profileData,
							tokens,
							user,
						);
					if (hookResult?.userId) userId = hookResult.userId;
					if (hookResult?.id) userId = hookResult.id;
					if (hookResult?.user?.id) userId = hookResult.user.id;
				} else if (userId && adapters.session && autoCreateSession) {
					const session = await adapters.session.createSession(userId);
					if (adapters.session.setSessionCookie) {
						adapters.session.setSessionCookie(event.cookies, session);
					}
				}

				// Store tokens if adapter provided
				if (adapters.token) {
					if (!userId) {
						console.warn(
							"[auth] Token adapter enabled but no userId resolved. Falling back to provider profile id.",
						);
					}
					await adapters.token.storeTokens(
						userId ?? profileData.id,
						providerName,
						tokens,
					);
				}
			},
			onError: hooks.onError
				? async (event, error) => {
						await hooks.onError(event, error);
				  }
				: undefined,
		});
	}

	const logoutHandler = createLogoutHandler({
		sessionAdapter: adapters.session,
		redirectAfterLogout: urlConfig.afterLogout,
		getSession: (locals) => locals.session,
		onLogout: hooks.onLogout
			? async (event) => {
					await hooks.onLogout(event);
			  }
			: undefined,
	});

	// Create hooks server handler
	const handleHooks = async ({ event, resolve }: { event: any; resolve: any }) => {
		const sessionId = event.cookies.get(adapters.session.cookieName ?? "session");

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

	const handlers: Record<string, any> = {
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
		handlers.magicLink = {
			request: createMagicLinkRequestHandler({
				...magicLink,
				magicLinkAdapter: adapters.magicLink,
				databaseAdapter: adapters.database,
			}),
			verify: createMagicLinkVerifyHandler({
				...magicLink,
				magicLinkAdapter: adapters.magicLink,
				databaseAdapter: adapters.database,
				sessionAdapter: adapters.session,
				redirectAfterLogin: urlConfig.afterLogin,
				secureCookies: cookieConfig.secure,
				onLogin: magicLink.onLogin || hooks.onLogin,
				isAuthenticated,
			}),
		};
	}

	if (webauthn) {
		handlers.webauthn = {
			registerOptions: createWebAuthnRegisterOptionsHandler({
				...webauthn,
				webauthnAdapter: adapters.webauthn,
			}),
			registerVerify: createWebAuthnRegisterVerifyHandler({
				...webauthn,
				webauthnAdapter: adapters.webauthn,
			}),
			loginOptions: createWebAuthnLoginOptionsHandler({
				...webauthn,
				webauthnAdapter: adapters.webauthn,
				databaseAdapter: adapters.database,
			}),
			loginVerify: createWebAuthnLoginVerifyHandler({
				...webauthn,
				webauthnAdapter: adapters.webauthn,
				databaseAdapter: adapters.database,
				sessionAdapter: adapters.session,
				redirectAfterLogin: urlConfig.afterLogin,
				onLogin: webauthn.onLogin || hooks.onLogin,
			}),
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
		routes,
		// Utility functions
		utils: {
			isAuthenticated: (locals: any) => isAuthenticated(locals),
			getUser: (locals: any) => locals.user,
			getSession: (locals: any) => locals.session,
		},
	};
}
