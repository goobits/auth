import { redirect } from '@sveltejs/kit'

import type { OAuthProvider } from '../providers/OAuthProvider.ts'
import type { AuthorizeOAuthIdentityChange, AuthLocals, RequestEventLike } from '../types/auth.ts'
import type { OAuthFlowIntent } from '../types/core.ts'
import { createOAuthCookies } from '../utils/oauth.ts'
import { isSafeRedirectPath } from '../utils/redirect.ts'

type LoginHandlerConfig = {
	providers: Record<string, { provider: OAuthProvider; scopes?: string[] }>
	redirectAfterLogin?: string
	secureCookies?: boolean
	isAuthenticated?: (locals: AuthLocals) => boolean
	authorizeIdentityChange?: AuthorizeOAuthIdentityChange
}

/**
 * Create a login route handler for OAuth providers
 *
 * @param {Object} config - Handler configuration
 * @param {Object.<string, {provider: import('../providers/OAuthProvider.ts').OAuthProvider, scopes?: string[]}>} config.providers - Provider instances and their configs
 * @param {string} [config.redirectAfterLogin] - URL to redirect to if already logged in
 * @param {boolean} [config.secureCookies=true] - Use secure cookies
 * @param {Function} [config.isAuthenticated] - Function to check if user is authenticated (receives event.locals)
 * @returns {import('@sveltejs/kit').RequestHandler}
 *
 * @example
 * // In src/routes/auth/signin/[provider]/+server.ts
 * import { createLoginHandler } from '@goobits/auth/handlers';
 * import { GoogleProvider, AppleProvider } from '@goobits/auth/providers';
 *
 * const googleProvider = new GoogleProvider({
 *   clientId: env.GOOGLE_CLIENT_ID,
 *   clientSecret: env.GOOGLE_CLIENT_SECRET,
 *   callbackUrl: `${APP_URL}/auth/callback/google`
 * });
 *
 * export const GET = createLoginHandler({
 *   providers: {
 *     google: { provider: googleProvider, scopes: ['openid', 'profile', 'email'] },
 *   },
 *   redirectAfterLogin: '/dashboard',
 *   isAuthenticated: (locals) => !!locals.user
 * });
 */
export function createLoginHandler(config: LoginHandlerConfig) {
	const {
		providers,
		redirectAfterLogin = '/',
		secureCookies = true,
		isAuthenticated = (locals: AuthLocals) => !!locals.user,
		authorizeIdentityChange
	} = config

	return async (event: RequestEventLike) => {
		const { cookies, params, locals } = event
		const intent = resolveOAuthIntent(params['intent'])
		const authenticated = isAuthenticated(locals)
		if (intent === 'sign-in' && authenticated) {
			throw redirect(302, isSafeRedirectPath(redirectAfterLogin) ? redirectAfterLogin : '/')
		}
		if (
			intent !== 'sign-in' &&
			(!authenticated ||
				!locals.user?.id ||
				!locals.session ||
				locals.session.userId !== locals.user.id)
		) {
			return new Response('Authentication required', { status: 401 })
		}

		const providerName = String(params['provider'] ?? '')
		const providerConfig = providers[providerName]

		if (!providerConfig) {
			return new Response('Invalid OAuth provider', { status: 400 })
		}
		if (
			intent === 'link' &&
			(!authorizeIdentityChange ||
				!(await authorizeIdentityChange({
					action: 'oauth.link',
					request: event.request,
					userId: locals.user!.id,
					session: locals.session ?? null,
					provider: providerName
				})))
		) {
			return new Response('Fresh authentication required', { status: 403 })
		}

		const { provider, scopes } = providerConfig
		if (provider.callbackMode === 'form_post' && !secureCookies) {
			return new Response('Form-post OAuth callbacks require secure cookies', { status: 500 })
		}

		// Generate state and code verifier cookies
		const { state, codeVerifier } = createOAuthCookies(cookies, providerName, {
			intent,
			userId: intent === 'sign-in' ? null : locals.user!.id,
			redirectTo: resolveReturnPath(event.url, redirectAfterLogin),
			secure: secureCookies,
			sameSite: provider.callbackMode === 'form_post' ? 'none' : 'lax'
		})

		// Create authorization URL
		const authUrl = await provider.createAuthorizationURL(state, codeVerifier, scopes || [])

		throw redirect(302, authUrl)
	}
}

function resolveOAuthIntent(value: string | undefined): OAuthFlowIntent {
	if (value === undefined || value === 'sign-in') return 'sign-in'
	if (value === 'link' || value === 'reauth') return value
	throw new Error('Invalid OAuth flow intent')
}

function resolveReturnPath(url: URL, fallback: string): string {
	const requested = url.searchParams.get('returnTo') ?? ''
	if (isSafeRedirectPath(requested)) return requested
	return isSafeRedirectPath(fallback) ? fallback : '/'
}
