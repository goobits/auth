import { createCallbackHandler } from '../handlers/callback.ts'
import { createLoginHandler } from '../handlers/login.ts'
import { createLogoutHandler } from '../handlers/logout.ts'
import { fail } from '@sveltejs/kit'
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
	createMfaVerifyHandler,
	type MfaLoginConfig
} from '../handlers/mfa.ts'
import { ensureSessionAfterLogin } from '../handlers/sessionLifecycle.ts'
import { rotateSessionAssurance } from '../handlers/_assuredSession.ts'
import { AuthPrincipalResolutionError } from '../errors/AuthPrincipalResolutionError.ts'
import { createSessionListHandler, createSessionRevokeHandler } from '../handlers/sessions.ts'
import {
	createOAuthIdentityListHandler,
	createOAuthIdentityUnlinkHandler
} from '../handlers/oauthIdentities.ts'
import {
	createWebAuthnLoginOptionsHandler,
	createWebAuthnLoginVerifyHandler,
	createWebAuthnListCredentialsHandler,
	createWebAuthnRemoveCredentialHandler,
	createWebAuthnRegisterOptionsHandler,
	createWebAuthnRegisterVerifyHandler,
	createWebAuthnStepUpOptionsHandler,
	createWebAuthnStepUpVerifyHandler,
	type WebAuthnLoginOptionsHandlerConfig,
	type WebAuthnLoginVerifyHandlerConfig,
	type WebAuthnListCredentialsHandlerConfig,
	type WebAuthnRemoveCredentialHandlerConfig,
	type WebAuthnRegisterOptionsHandlerConfig,
	type WebAuthnRegisterVerifyHandlerConfig,
	type WebAuthnStepUpOptionsHandlerConfig,
	type WebAuthnStepUpVerifyHandlerConfig
} from '#webauthn-handlers'
import { createAuthRateLimiter } from '../security/rateLimit.ts'
import type {
	AuthActions,
	AuthConfig,
	AuthHandlers,
	AuthLocals,
	AuthRoutes,
	AuthenticationLifecycleInput,
	MagicLinkConfig,
	OAuthProviderConfig,
	OnLoginMode,
	RequestEventLike
} from '../types/auth.ts'
import type { User } from '../types/index.ts'
import type { OAuthFlowContext } from '../utils/oauth.ts'
import { jsonResponse } from '../utils/http.ts'
import { isSafeRedirectPath } from '../utils/redirect.ts'
import type { ResolvedDefaults } from './config.ts'
import {
	createDefaultOAuthCredentialMutations,
	createDefaultWebAuthnCredentialMutation
} from './credentialMutations.ts'
import type { ResolvedSecurity } from './securitySetup.ts'
import { createAuthCsrf } from '../security/policy.ts'

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
		baseUrl: settings.baseUrl,
		...(settings.allowSignup !== undefined ? { allowSignup: settings.allowSignup } : {}),
		...(settings.expiresInMs !== undefined ? { expiresInMs: settings.expiresInMs } : {}),
		...(settings.magicLinkPath !== undefined ? { magicLinkPath: settings.magicLinkPath } : {}),
		...(settings.includeOtp !== undefined ? { includeOtp: settings.includeOtp } : {}),
		...(settings.otpDigits !== undefined ? { otpDigits: settings.otpDigits } : {}),
		...(settings.singleUsePerEmail !== undefined
			? { singleUsePerEmail: settings.singleUsePerEmail }
			: {}),
		...(settings.normalizeEmail !== undefined ? { normalizeEmail: settings.normalizeEmail } : {}),
		...(settings.otpPepper !== undefined ? { otpPepper: settings.otpPepper } : {}),
		...(settings.requireUserConfirmation !== undefined
			? { requireUserConfirmation: settings.requireUserConfirmation }
			: {}),
		...(settings.confirmationCookieName !== undefined
			? { confirmationCookieName: settings.confirmationCookieName }
			: {}),
		...(settings.confirmationTtlSeconds !== undefined
			? { confirmationTtlSeconds: settings.confirmationTtlSeconds }
			: {}),
		...(limits.request !== undefined ? { rateLimit: limits.request } : {}),
		...(limits.verify !== undefined ? { verifyRateLimit: limits.verify } : {}),
		...(hooks.getMetadata !== undefined ? { getMetadata: hooks.getMetadata } : {}),
		...(hooks.createUser !== undefined ? { createUser: hooks.createUser } : {}),
		...(hooks.sanitizeUser !== undefined ? { sanitizeUser: hooks.sanitizeUser } : {}),
		...(settings.key !== undefined ? { key: settings.key } : {})
	}
	const onAuthentication = globalHooks?.onAuthentication
	const beforeSessionCreate = globalHooks?.beforeSessionCreate
	return {
		...normalized,
		...(onAuthentication ? { onAuthentication } : {}),
		...(beforeSessionCreate ? { beforeSessionCreate } : {})
	}
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
	const { urlConfig, cookieConfig, autoCreateSession, isAuthenticated } = defaults
	const onLoginMode: OnLoginMode = hooks.onLoginMode ?? 'augment'
	const beforeSessionCreate = hooks.beforeSessionCreate
	const mfaLogin: MfaLoginConfig | undefined = mfa?.login
		? {
				...mfa.login,
				store: adapters.mfa!,
				verificationTokenAdapter: adapters.verificationToken!,
				secureCookies: mfa.login.secureCookies ?? cookieConfig.secure,
				challengeRedirect: mfa.login.challengeRedirect ?? urlConfig.login
			}
		: undefined
	const hasProviders = Object.keys(providers).length > 0
	const providerInstances = Object.fromEntries(
		Object.entries(providers as Record<string, OAuthProviderConfig>).map(
			([name, providerConfig]) => [name, providerConfig.provider]
		)
	)
	const oauthCredentialMutations = hasProviders
		? (config.credentialMutations?.oauth ??
			createDefaultOAuthCredentialMutations({
				identityAdapter: adapters.oauthIdentity!,
				...(adapters.oauthToken ? { tokenAdapter: adapters.oauthToken } : {}),
				...(config.oauth?.hooks ? { hooks: config.oauth.hooks } : {})
			}))
		: null
	const csrf = security.csrf.mode === 'off' ? null : createAuthCsrf(security)
	let loginHandler: AuthHandlers['login']
	let callbackHandler: AuthHandlers['callback']

	if (hasProviders) {
		const userAdapter = adapters.user!
		const identityAdapter = adapters.oauthIdentity!
		loginHandler = createLoginHandler({
			providers,
			redirectAfterLogin: urlConfig.afterLogin,
			secureCookies: cookieConfig.secure,
			isAuthenticated,
			...(config.oauth ? { authorizeIdentityChange: config.oauth.authorizeIdentityChange } : {})
		})

		const callbackConfig: Parameters<typeof createCallbackHandler>[0] = {
			providers: providerInstances,
			redirectAfterLogin: urlConfig.afterLogin,
			redirectOnCancellation: urlConfig.oauthCancelled,
			...(config.logger ? { logger: config.logger } : {}),
			onAuthenticated: async (event, profile, tokens, context: OAuthFlowContext) => {
				const providerName = String(event.params['provider'] ?? '')
				const subject = profile.id.trim()
				if (!subject || subject !== profile.id || subject.length > 512) {
					throw new AuthPrincipalResolutionError('Invalid provider subject', 400)
				}
				const currentUser = event.locals.user ?? null
				const currentSession = event.locals.session ?? null
				const identity = await identityAdapter.getIdentity(providerName, subject)
				let user = identity ? await userAdapter.getUserById(identity.userId) : null
				if (identity && !user) throw new AuthPrincipalResolutionError()

				if (context.intent === 'sign-in') {
					if (isAuthenticated(event.locals)) {
						throw new AuthPrincipalResolutionError('Sign-in session changed; try again', 409)
					}
				} else {
					if (
						!currentUser ||
						!currentSession ||
						currentSession.userId !== currentUser.id ||
						context.userId !== currentUser.id
					) {
						throw new AuthPrincipalResolutionError('Authentication required', 401)
					}
					if (context.intent === 'reauth') {
						if (!identity || identity.userId !== currentUser.id) {
							throw new AuthPrincipalResolutionError('Provider is not connected', 403)
						}
						user = currentUser
					} else {
						if (!config.oauth) {
							throw new AuthPrincipalResolutionError('Provider linking is unavailable', 403)
						}
						if (
							!(await config.oauth.authorizeIdentityChange({
								action: 'oauth.link',
								request: event.request,
								userId: currentUser.id,
								session: currentSession,
								provider: providerName
							}))
						) {
							throw new AuthPrincipalResolutionError('Fresh authentication required', 403)
						}
						if (identity && identity.userId !== currentUser.id) {
							throw new AuthPrincipalResolutionError(
								'Provider is already connected to another account',
								409
							)
						}
						user = currentUser
					}
				}

				const authentication: AuthenticationLifecycleInput = {
					event,
					method: {
						kind: 'oauth',
						intent: context.intent,
						provider: providerName,
						profile,
						tokens
					},
					user
				}
				const lifecycleResult = await hooks.onAuthentication?.(authentication)
				const resolvedUserId = lifecycleResult?.userId
					? String(lifecycleResult.userId)
					: (user?.id ?? null)
				const redirectTo = lifecycleResult?.redirectTo
				if (redirectTo && !isSafeRedirectPath(redirectTo)) {
					throw new AuthPrincipalResolutionError('Invalid authentication redirect', 400)
				}

				if (!resolvedUserId) {
					if (redirectTo) return redirectTo
					throw new AuthPrincipalResolutionError()
				}
				if (identity && identity.userId !== resolvedUserId) {
					throw new AuthPrincipalResolutionError()
				}
				if (context.intent !== 'sign-in' && resolvedUserId !== currentUser?.id) {
					throw new AuthPrincipalResolutionError()
				}

				const resolvedUser = user ?? (await userAdapter.getUserById(resolvedUserId))
				if (!resolvedUser || resolvedUser.id !== resolvedUserId) {
					throw new AuthPrincipalResolutionError()
				}
				let completionRedirect = redirectTo
				await oauthCredentialMutations!.connect({
					userId: resolvedUserId,
					provider: providerName,
					subject,
					expectedIdentityUserId: identity?.userId ?? null,
					tokens,
					intent: context.intent,
					event,
					completeAuthentication: async () => {
						if (context.intent === 'sign-in') {
							const completion = await ensureSessionAfterLogin({
								event,
								sessionAdapter: adapters.session,
								userId: resolvedUserId,
								user: resolvedUser,
								...(mfaLogin ? { mfa: mfaLogin } : {}),
								redirectTo: redirectTo || context.redirectTo || urlConfig.afterLogin,
								...(hooks.getSessionMetadata
									? { getSessionMetadata: hooks.getSessionMetadata }
									: {}),
								...(beforeSessionCreate
									? {
											beforeSessionCreate: () =>
												beforeSessionCreate({ ...authentication, user: resolvedUser })
										}
									: {}),
								autoCreateSession,
								onLoginMode
							})
							if (completion.status !== 'authenticated') {
								completionRedirect = completion.redirectTo
							}
						} else if (context.intent === 'reauth' && currentSession) {
							await rotateSessionAssurance({
								sessionAdapter: adapters.session,
								assurance: 'primary',
								cookies: event.cookies,
								currentSession,
								userId: resolvedUserId
							})
						}
					}
				})
				return completionRedirect
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
		const resolveWithCsrf = async () => {
			if (safeMethod && csrf) await csrf.getOrCreate(event as never)
			return resolve(event)
		}
		const sessionId = event.cookies.get(adapters.session.cookieName)
		if (!sessionId) {
			event.locals.session = null
			event.locals.user = null
			return resolveWithCsrf()
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
		return resolveWithCsrf()
	}

	const handlers: AuthHandlers = {
		logout: logoutHandler,
		hooks: handleHooks
	}
	if (loginHandler) handlers.login = loginHandler
	if (callbackHandler) handlers.callback = callbackHandler

	if (magicLink) {
		const normalizedMagicLink = normalizeMagicLinkConfig(magicLink, hooks, cookieConfig.secure)
		const sharedMagicVerifyLimiter = createAuthRateLimiter('login', {
			keyPrefix: `${security.rateLimit.keyPrefix}:magic-verify`,
			...(security.rateLimit.store ? { store: security.rateLimit.store } : {}),
			...(security.rateLimit.logger ? { logger: security.rateLimit.logger } : {})
		})
		const requestConfig: Parameters<typeof createMagicLinkRequestHandler>[0] = {
			...normalizedMagicLink,
			magicLinkAdapter: adapters.magicLink!,
			...(security.audit.emitter ? { emitSecurityEvent: security.audit.emitter } : {}),
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
			verifyRateLimit: normalizedMagicLink.verifyRateLimit ?? sharedMagicVerifyLimiter.check,
			csrfCookieName: security.csrf.cookieName,
			...(security.audit.emitter ? { emitSecurityEvent: security.audit.emitter } : {}),
			...(config.logger ? { logger: config.logger } : {}),
			...(normalizedMagicLink['sanitizeUser'] === undefined ? { sanitizeUser } : {}),
			...(hooks.getSessionMetadata ? { getSessionMetadata: hooks.getSessionMetadata } : {}),
			...(mfaLogin ? { mfa: mfaLogin } : {}),
			...(adapters.user ? { userAdapter: adapters.user } : {})
		}
		handlers.magicLink = {
			request: createMagicLinkRequestHandler(requestConfig),
			verify: createMagicLinkVerifyHandler(verifyConfig)
		}
	}

	if (webauthn) {
		const removeCredentialMutation =
			config.credentialMutations?.webauthn?.remove ??
			createDefaultWebAuthnCredentialMutation({
				webauthnAdapter: adapters.webauthn!,
				...(webauthn.hooks?.onCredentialDeleted
					? { onCredentialDeleted: webauthn.hooks.onCredentialDeleted }
					: {})
			})
		const attestationType = webauthn.attestation === 'indirect' ? 'none' : webauthn.attestation
		const registerOptionsConfig: WebAuthnRegisterOptionsHandlerConfig = {
			authorizeSecurityChange: webauthn.authorizeSecurityChange,
			webauthnAdapter: adapters.webauthn!,
			rpID: webauthn.rpID ?? '',
			rpName: webauthn.rpName ?? 'Passkey',
			attestationType,
			...(webauthn.timeoutMs ? { timeout: webauthn.timeoutMs } : {}),
			...(webauthn.maxCredentialsPerUser
				? { maxCredentialsPerUser: webauthn.maxCredentialsPerUser }
				: {})
		}
		const registerVerifyConfig: WebAuthnRegisterVerifyHandlerConfig = {
			webauthnAdapter: adapters.webauthn!,
			rpID: webauthn.rpID ?? '',
			origin: webauthn.origin ?? '',
			...(webauthn.maxCredentialsPerUser
				? { maxCredentialsPerUser: webauthn.maxCredentialsPerUser }
				: {}),
			...(webauthn.hooks?.onCredentialCreated
				? { onCredentialCreated: webauthn.hooks.onCredentialCreated }
				: {}),
			...(security.audit.emitter ? { emitSecurityEvent: security.audit.emitter } : {})
		}
		const loginOptionsConfig: WebAuthnLoginOptionsHandlerConfig = {
			webauthnAdapter: adapters.webauthn!,
			rpID: webauthn.rpID ?? '',
			...(webauthn.timeoutMs ? { timeout: webauthn.timeoutMs } : {})
		}
		const loginVerifyConfig: WebAuthnLoginVerifyHandlerConfig = {
			webauthnAdapter: adapters.webauthn!,
			sessionAdapter: adapters.session,
			rpID: webauthn.rpID ?? '',
			origin: webauthn.origin ?? '',
			redirectAfterLogin: urlConfig.afterLogin,
			autoCreateSession,
			onLoginMode,
			sanitizeUser,
			...(hooks.getSessionMetadata ? { getSessionMetadata: hooks.getSessionMetadata } : {}),
			...(beforeSessionCreate ? { beforeSessionCreate } : {}),
			...(security.audit.emitter ? { emitSecurityEvent: security.audit.emitter } : {}),
			...(adapters.user ? { userAdapter: adapters.user } : {})
		}
		if (hooks.onAuthentication) {
			loginVerifyConfig.onAuthentication = hooks.onAuthentication
		}
		const listCredentialsConfig: WebAuthnListCredentialsHandlerConfig = {
			webauthnAdapter: adapters.webauthn!
		}
		const removeCredentialConfig: WebAuthnRemoveCredentialHandlerConfig = {
			webauthnAdapter: adapters.webauthn!,
			authorizeSecurityChange: webauthn.authorizeSecurityChange,
			mutation: removeCredentialMutation,
			...(security.audit.emitter ? { emitSecurityEvent: security.audit.emitter } : {})
		}
		const stepUpOptionsConfig: WebAuthnStepUpOptionsHandlerConfig = {
			webauthnAdapter: adapters.webauthn!,
			rpID: webauthn.rpID ?? '',
			...(webauthn.timeoutMs ? { timeout: webauthn.timeoutMs } : {})
		}
		const stepUpVerifyConfig: WebAuthnStepUpVerifyHandlerConfig = {
			webauthnAdapter: adapters.webauthn!,
			sessionAdapter: adapters.session,
			rpID: webauthn.rpID ?? '',
			origin: webauthn.origin ?? '',
			...(security.audit.emitter ? { emitSecurityEvent: security.audit.emitter } : {})
		}
		handlers.webauthn = {
			registerOptions: createWebAuthnRegisterOptionsHandler(registerOptionsConfig),
			registerVerify: createWebAuthnRegisterVerifyHandler(registerVerifyConfig),
			loginOptions: createWebAuthnLoginOptionsHandler(loginOptionsConfig),
			loginVerify: createWebAuthnLoginVerifyHandler(loginVerifyConfig),
			listCredentials: createWebAuthnListCredentialsHandler(listCredentialsConfig),
			removeCredential: createWebAuthnRemoveCredentialHandler(removeCredentialConfig),
			stepUpOptions: createWebAuthnStepUpOptionsHandler(stepUpOptionsConfig),
			stepUpVerify: createWebAuthnStepUpVerifyHandler(stepUpVerifyConfig)
		}
	}

	if (mfa) {
		const getUserId = (locals: AuthLocals) => locals.user?.id ?? null
		const mfaConfig = {
			authorizeSecurityChange: mfa.authorizeSecurityChange,
			getUserId,
			store: adapters.mfa!,
			...(mfa.issuer ? { issuer: mfa.issuer } : {}),
			...(mfa.label ? { label: mfa.label } : {}),
			...(mfa.hooks ? { hooks: mfa.hooks } : {})
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

	if (hasProviders && config.oauth) {
		handlers.oauth = {
			identities: createOAuthIdentityListHandler({
				identityAdapter: adapters.oauthIdentity!
			}),
			unlink: createOAuthIdentityUnlinkHandler({
				identityAdapter: adapters.oauthIdentity!,
				providers: providerInstances,
				authorizeIdentityChange: config.oauth.authorizeIdentityChange,
				mutation: oauthCredentialMutations!.unlink,
				...(adapters.oauthToken ? { tokenAdapter: adapters.oauthToken } : {}),
				...(config.oauth.hooks ? { hooks: config.oauth.hooks } : {})
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
			return { GET: handlers.callback, POST: handlers.callback }
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
		passkeyCredentials: () => {
			if (!handlers.webauthn) throw new Error('WebAuthn handlers not configured')
			return {
				GET: handlers.webauthn.listCredentials,
				POST: handlers.webauthn.removeCredential
			}
		},
		passkeyStepUpOptions: () => {
			if (!handlers.webauthn) throw new Error('WebAuthn handlers not configured')
			return { POST: handlers.webauthn.stepUpOptions }
		},
		passkeyStepUpVerify: () => {
			if (!handlers.webauthn) throw new Error('WebAuthn handlers not configured')
			return { POST: handlers.webauthn.stepUpVerify }
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
		},
		oauthIdentities: () => {
			if (!handlers.oauth) throw new Error('OAuth identity handlers not configured')
			return { GET: handlers.oauth.identities }
		},
		oauthUnlink: () => {
			if (!handlers.oauth) throw new Error('OAuth identity handlers not configured')
			return { POST: handlers.oauth.unlink }
		}
	}
}

async function readActionResponse(response: Response): Promise<Record<string, unknown>> {
	if (response.status === 204) return { ok: true }

	const contentType = response.headers.get('content-type') ?? ''
	if (contentType.includes('application/json')) {
		const data: unknown = await response.json()
		return data && typeof data === 'object' && !Array.isArray(data)
			? (data as Record<string, unknown>)
			: { data }
	}

	const message = await response.text()
	return message ? { message } : { ok: response.ok }
}

/** Builds SvelteKit form actions from secured auth request handlers. */
export function buildActions(handlers: AuthHandlers): AuthActions {
	return {
		logout: () => ({
			default: async (event) => {
				const response = await handlers.logout(event as unknown as RequestEventLike)
				const data = await readActionResponse(response)
				return response.ok ? data : fail(response.status, data)
			}
		})
	}
}

export function createUtils(isAuthenticated: (locals: AuthLocals) => boolean) {
	return {
		isAuthenticated: (locals: AuthLocals) => isAuthenticated(locals),
		getUser: (locals: AuthLocals) => locals.user,
		getSession: (locals: AuthLocals) => locals.session
	}
}
