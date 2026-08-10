import { AuthPrincipalResolutionError } from '../errors/AuthPrincipalResolutionError.ts'
import type { MfaLoginConfig } from '../handlers/_mfaTypes.ts'
import { rotateSessionAssurance } from '../handlers/_assuredSession.ts'
import { createCallbackHandler } from '../handlers/callback.ts'
import { createLoginHandler } from '../handlers/login.ts'
import {
	createOAuthIdentityListHandler,
	createOAuthIdentityUnlinkHandler
} from '../handlers/oauthIdentities.ts'
import { ensureSessionAfterLogin } from '../handlers/sessionLifecycle.ts'
import type {
	AuthConfig,
	AuthHandlers,
	AuthenticationLifecycleInput,
	OAuthProviderConfig,
	RequestEventLike
} from '../types/auth.ts'
import type { OAuthFlowContext } from '../utils/oauth.ts'
import { isSafeRedirectPath } from '../utils/redirect.ts'
import type { ResolvedDefaults } from './config.ts'
import { createDefaultOAuthCredentialMutations } from './credentialMutations.ts'

type OAuthHandlers = Partial<Pick<AuthHandlers, 'login' | 'callback' | 'oauth'>>

export function createOAuthHandlers(
	config: AuthConfig,
	defaults: ResolvedDefaults,
	mfaLogin: MfaLoginConfig | undefined
): OAuthHandlers {
	const { adapters, hooks = {}, providers = {} } = config
	if (Object.keys(providers).length === 0) return {}

	const { urlConfig, cookieConfig, autoCreateSession, isAuthenticated } = defaults
	const userAdapter = adapters.user!
	const identityAdapter = adapters.oauthIdentity!
	const providerInstances = Object.fromEntries(
		Object.entries(providers as Record<string, OAuthProviderConfig>).map(
			([name, providerConfig]) => [name, providerConfig.provider]
		)
	)
	const credentialMutations =
		config.credentialMutations?.oauth ??
		createDefaultOAuthCredentialMutations({
			identityAdapter,
			...(adapters.oauthToken ? { tokenAdapter: adapters.oauthToken } : {}),
			...(config.oauth?.hooks ? { hooks: config.oauth.hooks } : {})
		})

	const login = createLoginHandler({
		providers,
		redirectAfterLogin: urlConfig.afterLogin,
		secureCookies: cookieConfig.secure,
		isAuthenticated,
		...(config.oauth ? { authorizeIdentityChange: config.oauth.authorizeIdentityChange } : {})
	})
	const callback = createCallbackHandler({
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
			await credentialMutations.connect({
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
							...(hooks.getSessionMetadata ? { getSessionMetadata: hooks.getSessionMetadata } : {}),
							...(hooks.beforeSessionCreate
								? {
										beforeSessionCreate: () =>
											hooks.beforeSessionCreate?.({
												...authentication,
												user: resolvedUser
											})
									}
								: {}),
							autoCreateSession,
							onLoginMode: hooks.onLoginMode ?? 'augment'
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
	})

	return {
		login,
		callback,
		...(config.oauth
			? {
					oauth: {
						identities: createOAuthIdentityListHandler({ identityAdapter }),
						unlink: createOAuthIdentityUnlinkHandler({
							identityAdapter,
							providers: providerInstances,
							authorizeIdentityChange: config.oauth.authorizeIdentityChange,
							mutation: credentialMutations.unlink,
							...(adapters.oauthToken ? { tokenAdapter: adapters.oauthToken } : {}),
							...(config.oauth.hooks ? { hooks: config.oauth.hooks } : {})
						})
					}
				}
			: {})
	}
}
