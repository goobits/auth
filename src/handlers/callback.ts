import { error, redirect } from '@sveltejs/kit'
import { BodyTooLargeError } from '@goobits/security/request-body'

import { OAuth2RequestError } from '../_internal/oauth2.ts'
import { AuthPrincipalResolutionError } from '../errors/AuthPrincipalResolutionError.ts'
import { errorContext, resolveLogger, type Logger } from '../_internal/logger.ts'
import type { OAuthProvider } from '../providers/OAuthProvider.ts'
import type { RequestEventLike } from '../types/auth.ts'
import type { OAuthProfile, OAuthTokens } from '../types/index.ts'
import { handleOAuthCallback, type OAuthFlowContext } from '../utils/oauth.ts'
import { readRequestFormData } from '../utils/http.ts'
import { isSafeRedirectPath } from '../utils/redirect.ts'

type CallbackConfig = {
	providers: Record<string, OAuthProvider>
	redirectAfterLogin?: string
	onAuthenticated: (
		event: RequestEventLike,
		profile: OAuthProfile,
		tokens: OAuthTokens,
		context: OAuthFlowContext
	) => Promise<string | void> | string | void
	onError?: (event: RequestEventLike, error: unknown) => Promise<void> | void
	logger?: Logger
}

/**
 * Create a callback route handler for OAuth providers
 *
 * @param {Object} config - Handler configuration
 * @param {Object.<string, import('../providers/OAuthProvider.ts').OAuthProvider>} config.providers - Provider instances mapped by name
 * @param {string} [config.redirectAfterLogin] - URL to redirect to after successful auth
 * @param {Function} config.onAuthenticated - Called with (event, profile, tokens, context) after successful auth
 * @param {Function} [config.onError] - Optional error handler, called with (event, error)
 * @returns {import('@sveltejs/kit').RequestHandler}
 *
 * @example
 * // In src/routes/auth/callback/[provider]/+server.ts
 * import { createCallbackHandler } from '@goobits/auth/handlers';
 * import { GoogleProvider } from '@goobits/auth/providers';
 *
 * const googleProvider = new GoogleProvider({...});
 *
 * export const GET = createCallbackHandler({
 *   providers: { google: googleProvider },
 *   redirectAfterLogin: '/dashboard',
 *   onAuthenticated: async (event, profile, tokens, context) => {
 *     // Store tokens, create/update user, start session
 *     const user = await findOrCreateUser(profile);
 *     await sessionAdapter.createSession(user.id);
 *   }
 * });
 */
export function createCallbackHandler(config: CallbackConfig) {
	const { providers, redirectAfterLogin = '/', onAuthenticated, onError, logger } = config
	const log = resolveLogger(logger)

	const isStatusError = (value: unknown): value is { status: number } =>
		typeof value === 'object' &&
		value !== null &&
		'status' in value &&
		typeof (value as { status?: unknown }).status === 'number'

	return async (event: RequestEventLike) => {
		const { params } = event
		const lifecycleEvent: RequestEventLike = {
			cookies: event.cookies,
			locals: event.locals,
			params: event.params,
			request: event.request.clone(),
			url: event.url,
			...(event.getClientAddress ? { getClientAddress: () => event.getClientAddress!() } : {})
		}

		try {
			const providerName = String(params['provider'] ?? '')
			const providerInstance = providers[providerName]

			if (!providerInstance) {
				error(400, 'Invalid OAuth provider')
			}

			// Extract Apple user data and callback params if present (POST form data)
			let appleUserData: string | null = null
			let overrideParams: { code: string | null; state: string | null } | null = null
			if (providerInstance.callbackMode === 'form_post' && event.request.method === 'POST') {
				const formData = await readRequestFormData(event.request)
				appleUserData = formData.get('user')?.toString() ?? null
				overrideParams = {
					code: formData.get('code')?.toString() ?? null,
					state: formData.get('state')?.toString() ?? null
				}
			}

			// Handle OAuth callback
			let resolvedRedirect = redirectAfterLogin
			const callbacks: Parameters<typeof handleOAuthCallback>[0]['callbacks'] = {
				onAuthenticated: async (
					userProfile: OAuthProfile,
					tokens: OAuthTokens,
					context: OAuthFlowContext
				) => {
					resolvedRedirect =
						(await onAuthenticated(lifecycleEvent, userProfile, tokens, context)) ||
						context.redirectTo
				},
				...(onError ? { onError: async (err: unknown) => onError(lifecycleEvent, err) } : {})
			}
			await handleOAuthCallback({
				event,
				provider: providerName,
				providerInstance,
				appleUserData,
				overrideParams,
				callbacks
			})

			throw redirect(302, isSafeRedirectPath(resolvedRedirect) ? resolvedRedirect : '/')
		} catch (err) {
			if (err instanceof BodyTooLargeError) {
				error(413, 'Request body too large')
			}
			// Handle OAuth2 errors
			if (err instanceof OAuth2RequestError) {
				error(400, 'OAuth authentication failed')
			}

			// Re-throw redirects and errors
			if (isStatusError(err)) {
				throw err
			}
			if (err instanceof AuthPrincipalResolutionError) {
				error(err.status, err.message)
			}

			// Log and throw generic error
			log.error('Authentication error', errorContext(err))
			error(500, 'Authentication system error')
		}
	}
}
