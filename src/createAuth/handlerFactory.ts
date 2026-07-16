import { createCallbackHandler } from '../handlers/callback.ts'
import { createLoginHandler } from '../handlers/login.ts'
import { createLogoutHandler } from '../handlers/logout.ts'
import {
	createMagicLinkRequestHandler,
	createMagicLinkVerifyHandler
} from '../handlers/magicLink.ts'
import {
	createMfaBackupCodeHandler,
	createMfaDisableHandler,
	createMfaEnrollHandler,
	createMfaStatusHandler,
	createMfaStepUpHandler,
	createMfaVerifyHandler
} from '../handlers/mfa.ts'
import { ensureSessionAfterLogin } from '../handlers/sessionLifecycle.ts'
import { AuthPrincipalResolutionError } from '../errors/AuthPrincipalResolutionError.ts'
import { createSessionListHandler, createSessionRevokeHandler } from '../handlers/sessions.ts'
import {
	createWebAuthnLoginOptionsHandler,
	createWebAuthnLoginVerifyHandler,
	createWebAuthnRegisterOptionsHandler,
	createWebAuthnRegisterVerifyHandler,
	type WebAuthnLoginOptionsHandlerConfig,
	type WebAuthnLoginVerifyHandlerConfig,
	type WebAuthnRegisterOptionsHandlerConfig,
	type WebAuthnRegisterVerifyHandlerConfig
} from '../handlers/webauthn.ts'
import { issueCsrfToken } from '../security/csrf.ts'
import type {
	AuthConfig,
	AuthHandlers,
	AuthLocals,
	AuthLoginResult,
	AuthRoutes,
	MagicLinkConfig,
	OAuthProviderConfig,
	OnLoginMode,
	RequestEventLike
} from '../types/auth.ts'
import type { User } from '../types/index.ts'
import { jsonResponse } from '../utils/http.ts'
import type { ResolvedDefaults } from './config.ts'
import type { ResolvedSecurity } from './securitySetup.ts'

function resolveOnLoginUserId(
	hookResult: AuthLoginResult,
	fallbackUserId: string | null
): string | null {
	if (hookResult && typeof hookResult === 'object' && hookResult['userId']) {
		return String(hookResult['userId'])
	}
	return fallbackUserId
}

function normalizeMagicLinkConfig(
	magicLink: MagicLinkConfig,
	globalHooks: AuthConfig['hooks'],
	defaultSecureCookies: boolean
) {
	const settings = magicLink.settings ?? {}
	const limits = magicLink.limits ?? {}
	const hooks = magicLink.hooks ?? {}
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
		...(settings.requireUserConfirmation !== undefined
			? { requireUserConfirmation: settings.requireUserConfirmation }
			: {}),
		...(settings.confirmationCookieName !== undefined
			? { confirmationCookieName: settings.confirmationCookieName }
			: {}),
		...(settings.confirmationTtlSeconds !== undefined
			? { confirmationTtlSeconds: settings.confirmationTtlSeconds }
			: {}),
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
		...(settings.key !== undefined ? { key: settings.key } : {})
	}
	const onLogin = hooks.onLogin ?? globalHooks?.onLogin
	return onLogin ? { ...normalized, onLogin } : normalized
}

function asJsonHandler(
	handler: (event: RequestEventLike) => Promise<unknown>
): NonNullable<AuthHandlers['mfa']>['status'] {
	return async (event) => jsonResponse(await handler(event as RequestEventLike))
}

export function createHandlers(
	config: AuthConfig,
	defaults: ResolvedDefaults,
	security: ResolvedSecurity
): AuthHandlers {
	const {
		adapters,
		providers = {},
		hooks = {},
		magicLink,
		webauthn,
		mfa,
		sessions,
		sanitizeUser = (user: User | null) => user
	} = config
	const {
		urlConfig,
		cookieConfig,
		autoCreateSession,
		requireVerifiedEmailForLinking,
		isAuthenticated
	} = defaults
	const onLoginMode: OnLoginMode = hooks.onLoginMode ?? 'augment'
	const hasProviders = Object.keys(providers).length > 0
	let loginHandler: AuthHandlers['login']
	let callbackHandler: AuthHandlers['callback']

	if (hasProviders) {
		loginHandler = createLoginHandler({
			providers,
			redirectAfterLogin: urlConfig.afterLogin,
			secureCookies: cookieConfig.secure,
			isAuthenticated
		})

		const callbackConfig: Parameters<typeof createCallbackHandler>[0] = {
			providers: Object.fromEntries(
				Object.entries(providers as Record<string, OAuthProviderConfig>).map(
					([name, providerConfig]) => [name, providerConfig.provider]
				)
			),
			redirectAfterLogin: urlConfig.afterLogin,
			isAuthenticated,
			...(config.logger ? { logger: config.logger } : {}),
			onAuthenticated: async (event, profile, tokens) => {
				const providerName = String(event.params['provider'] ?? '')
				let user = null
				let needsProviderLink = false

				if (adapters.user) {
					user = await adapters.user.getUserByProviderId(providerName, profile.id)
					needsProviderLink = !user

					if (!user && profile.email) {
						const existingByEmail = await adapters.user.getUserByEmail(profile.email)
						if (existingByEmail) {
							if (profile.verified_email !== true) {
								throw new AuthPrincipalResolutionError(
									'Provider must verify the email before OAuth account linking',
									403
								)
							}
							if (requireVerifiedEmailForLinking && existingByEmail.emailVerified !== true) {
								throw new AuthPrincipalResolutionError(
									'Existing account email must be verified before OAuth linking',
									403
								)
							}
							user = existingByEmail
						}
					}
					if (!user) {
						user = await adapters.user.createUser(profile)
					}
					if (user && needsProviderLink && adapters.user.linkOAuthAccount) {
						await adapters.user.linkOAuthAccount(user.id, providerName, profile.id)
					}
				}

				let userId = user?.id ? String(user.id) : null
				if (hooks.onLogin) {
					const hookResult = await hooks.onLogin(event, profile, tokens, user)
					userId = resolveOnLoginUserId(hookResult, userId)
				}
				if (adapters.oauthToken) {
					if (!userId) {
						throw new AuthPrincipalResolutionError()
					}
					await adapters.oauthToken.storeTokens(userId, providerName, tokens)
				}

				await ensureSessionAfterLogin({
					event,
					sessionAdapter: adapters.session,
					userId,
					autoCreateSession,
					onLoginMode
				})
			},
			...(hooks.onError
				? {
						onError: async (event: RequestEventLike, error: unknown) => {
							await hooks.onError?.(event, error)
						}
					}
				: {})
		}
		callbackHandler = createCallbackHandler(callbackConfig)
	}

	const logoutHandler = createLogoutHandler({
		sessionAdapter: adapters.session,
		redirectAfterLogout: urlConfig.afterLogout,
		getSession: (locals: AuthLocals) => locals.session ?? null,
		...(config.logger ? { logger: config.logger } : {}),
		...(hooks.onLogout
			? {
					onLogout: async (event: RequestEventLike) => {
						await hooks.onLogout?.(event)
					}
				}
			: {})
	})

	const handleHooks: AuthHandlers['hooks'] = async ({ event, resolve }) => {
		const method = event.request.method.toUpperCase()
		const safeMethod = method === 'GET' || method === 'HEAD' || method === 'OPTIONS'
		if (safeMethod && security.csrf.mode !== 'off') {
			const existingToken = event.cookies.get(security.csrf.cookieName)
			if (!existingToken) {
				await issueCsrfToken({
					cookies: event.cookies,
					cookieName: security.csrf.cookieName,
					secure: defaults.cookieConfig.secure,
					...(security.csrf.httpOnly !== undefined ? { httpOnly: security.csrf.httpOnly } : {}),
					...(security.csrf.store ? { store: security.csrf.store } : {})
				})
			}
		}
		const sessionCookieName =
			(adapters.session as { cookieName?: string })['cookieName'] ?? 'session'
		const sessionId = event.cookies.get(sessionCookieName)
		if (!sessionId) {
			event.locals.session = null
			event.locals.user = null
			return resolve(event)
		}
		const { session, user } = await adapters.session.validateSession(sessionId)
		event.locals.session = session
		event.locals.user = sanitizeUser(user)
		if (session && user) {
			if (hooks.onSessionValidated) {
				await hooks.onSessionValidated(event, session, user)
			}
			if (session.fresh) {
				adapters.session.setSessionCookie?.(event.cookies, session)
			}
		} else {
			adapters.session.deleteSessionCookie?.(event.cookies)
		}
		return resolve(event)
	}

	const handlers: AuthHandlers = {
		logout: logoutHandler,
		hooks: handleHooks
	}
	if (loginHandler) handlers.login = loginHandler
	if (callbackHandler) handlers.callback = callbackHandler

	if (magicLink) {
		const normalizedMagicLink = normalizeMagicLinkConfig(magicLink, hooks, cookieConfig.secure)
		const requestConfig: Parameters<typeof createMagicLinkRequestHandler>[0] = {
			...normalizedMagicLink,
			magicLinkAdapter: adapters.magicLink!,
			...(config.logger ? { logger: config.logger } : {}),
			...(adapters.user ? { userAdapter: adapters.user } : {})
		}
		const verifyConfig: Parameters<typeof createMagicLinkVerifyHandler>[0] = {
			...normalizedMagicLink,
			magicLinkAdapter: adapters.magicLink!,
			sessionAdapter: adapters.session,
			autoCreateSession,
			onLoginMode,
			redirectAfterLogin: urlConfig.afterLogin,
			isAuthenticated,
			csrfCookieName: security.csrf.cookieName,
			...(config.logger ? { logger: config.logger } : {}),
			...(normalizedMagicLink['sanitizeUser'] === undefined ? { sanitizeUser } : {}),
			...(adapters.user ? { userAdapter: adapters.user } : {})
		}
		handlers.magicLink = {
			request: createMagicLinkRequestHandler(requestConfig),
			verify: createMagicLinkVerifyHandler(verifyConfig)
		}
	}

	if (webauthn) {
		const attestationType = webauthn.attestation === 'indirect' ? 'none' : webauthn.attestation
		const registerOptionsConfig: WebAuthnRegisterOptionsHandlerConfig = {
			authorizeSecurityChange: webauthn.authorizeSecurityChange,
			webauthnAdapter: adapters.webauthn!,
			rpID: webauthn.rpID ?? '',
			rpName: webauthn.rpName ?? 'Passkey',
			attestationType,
			...(webauthn.timeoutMs ? { timeout: webauthn.timeoutMs } : {}),
			...(webauthn.userVerification ? { userVerification: webauthn.userVerification } : {})
		}
		const registerVerifyConfig: WebAuthnRegisterVerifyHandlerConfig = {
			webauthnAdapter: adapters.webauthn!,
			rpID: webauthn.rpID ?? '',
			origin: webauthn.origin ?? '',
			requireUserVerification: webauthn.userVerification === 'required'
		}
		const loginOptionsConfig: WebAuthnLoginOptionsHandlerConfig = {
			webauthnAdapter: adapters.webauthn!,
			rpID: webauthn.rpID ?? '',
			...(webauthn.timeoutMs ? { timeout: webauthn.timeoutMs } : {}),
			...(webauthn.userVerification ? { userVerification: webauthn.userVerification } : {}),
			...(adapters.user ? { userAdapter: adapters.user } : {})
		}
		const loginVerifyConfig: WebAuthnLoginVerifyHandlerConfig = {
			webauthnAdapter: adapters.webauthn!,
			sessionAdapter: adapters.session,
			rpID: webauthn.rpID ?? '',
			origin: webauthn.origin ?? '',
			redirectAfterLogin: urlConfig.afterLogin,
			requireUserVerification: webauthn.userVerification === 'required',
			autoCreateSession,
			onLoginMode,
			sanitizeUser,
			...(adapters.user ? { userAdapter: adapters.user } : {})
		}
		const webauthnOnLogin = webauthn.hooks?.onLogin ?? hooks.onLogin
		if (webauthnOnLogin) {
			loginVerifyConfig.onLogin = webauthnOnLogin
		}
		handlers.webauthn = {
			registerOptions: createWebAuthnRegisterOptionsHandler(registerOptionsConfig),
			registerVerify: createWebAuthnRegisterVerifyHandler(registerVerifyConfig),
			loginOptions: createWebAuthnLoginOptionsHandler(loginOptionsConfig),
			loginVerify: createWebAuthnLoginVerifyHandler(loginVerifyConfig)
		}
	}

	if (mfa) {
		const getUserId = (locals: AuthLocals) => locals.user?.id ?? null
		const mfaConfig = {
			authorizeSecurityChange: mfa.authorizeSecurityChange,
			getUserId,
			store: adapters.mfa!,
			...(mfa.issuer ? { issuer: mfa.issuer } : {}),
			...(mfa.label ? { label: mfa.label } : {})
		}
		handlers.mfa = {
			status: asJsonHandler(createMfaStatusHandler(mfaConfig)),
			enroll: asJsonHandler(createMfaEnrollHandler(mfaConfig)),
			verify: asJsonHandler(
				createMfaVerifyHandler({ ...mfaConfig, sessionAdapter: adapters.session })
			),
			disable: asJsonHandler(createMfaDisableHandler(mfaConfig)),
			backupCode: asJsonHandler(createMfaBackupCodeHandler(mfaConfig)),
			stepUp: asJsonHandler(
				createMfaStepUpHandler({ ...mfaConfig, sessionAdapter: adapters.session })
			)
		}
	}

	if (sessions) {
		handlers.sessions = {
			list: createSessionListHandler({
				...sessions,
				sessionAdapter: adapters.session,
				isAuthenticated
			}),
			revoke: createSessionRevokeHandler({
				...sessions,
				sessionAdapter: adapters.session,
				isAuthenticated
			})
		}
	}

	return handlers
}

export function buildRoutes(handlers: AuthHandlers): AuthRoutes {
	return {
		login: () => {
			if (!handlers.login) throw new Error('OAuth login handler not configured')
			return { GET: handlers.login }
		},
		callback: () => {
			if (!handlers.callback) throw new Error('OAuth callback handler not configured')
			return { GET: handlers.callback }
		},
		logout: () => ({ POST: handlers.logout }),
		magicLink: () => {
			if (!handlers.magicLink) throw new Error('Magic link handlers not configured')
			return { POST: handlers.magicLink.request }
		},
		magicLinkVerify: () => {
			if (!handlers.magicLink) throw new Error('Magic link handlers not configured')
			return { GET: handlers.magicLink.verify, POST: handlers.magicLink.verify }
		},
		passkeyRegisterOptions: () => {
			if (!handlers.webauthn) throw new Error('WebAuthn handlers not configured')
			return { POST: handlers.webauthn.registerOptions }
		},
		passkeyRegisterVerify: () => {
			if (!handlers.webauthn) throw new Error('WebAuthn handlers not configured')
			return { POST: handlers.webauthn.registerVerify }
		},
		passkeyLoginOptions: () => {
			if (!handlers.webauthn) throw new Error('WebAuthn handlers not configured')
			return { POST: handlers.webauthn.loginOptions }
		},
		passkeyLoginVerify: () => {
			if (!handlers.webauthn) throw new Error('WebAuthn handlers not configured')
			return { POST: handlers.webauthn.loginVerify }
		},
		mfaStatus: () => {
			if (!handlers.mfa) throw new Error('MFA handlers not configured')
			return { GET: handlers.mfa.status }
		},
		mfaEnroll: () => {
			if (!handlers.mfa) throw new Error('MFA handlers not configured')
			return { POST: handlers.mfa.enroll }
		},
		mfaVerify: () => {
			if (!handlers.mfa) throw new Error('MFA handlers not configured')
			return { POST: handlers.mfa.verify }
		},
		mfaDisable: () => {
			if (!handlers.mfa) throw new Error('MFA handlers not configured')
			return { POST: handlers.mfa.disable }
		},
		mfaBackupCode: () => {
			if (!handlers.mfa) throw new Error('MFA handlers not configured')
			return { POST: handlers.mfa.backupCode }
		},
		mfaStepUp: () => {
			if (!handlers.mfa) throw new Error('MFA handlers not configured')
			return { POST: handlers.mfa.stepUp }
		},
		sessions: () => {
			if (!handlers.sessions) throw new Error('Session handlers not configured')
			return { GET: handlers.sessions.list, POST: handlers.sessions.revoke }
		}
	}
}

export function createUtils(isAuthenticated: (locals: AuthLocals) => boolean) {
	return {
		isAuthenticated: (locals: AuthLocals) => isAuthenticated(locals),
		getUser: (locals: AuthLocals) => locals.user,
		getSession: (locals: AuthLocals) => locals.session
	}
}
