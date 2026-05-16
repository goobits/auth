import { redirect } from '@sveltejs/kit'

import type { OAuthProvider } from '../providers/base.js'
import type { AuthLocals, RequestEventLike } from '../types/auth.js'
import { createOAuthCookies, resolveSafeReturnTo } from '../utils/oauth.js'

export type LoginHandlerConfig = {
	allowedReturnToOrigins?: string[];
	providers: Record<string, { provider: OAuthProvider; scopes?: string[] }>;
	redirectAfterLogin?: string;
	secureCookies?: boolean;
	isAuthenticated?: (locals: AuthLocals) => boolean;
}

/**
 * Create a login route handler for OAuth providers
 *
 * @param {Object} config - Handler configuration
 * @param {Object.<string, {provider: import('../providers/base.js').OAuthProvider, scopes?: string[]}>} config.providers - Provider instances and their configs
 * @param {string} [config.redirectAfterLogin] - URL to redirect to if already logged in
 * @param {boolean} [config.secureCookies=true] - Use secure cookies
 * @param {Function} [config.isAuthenticated] - Function to check if user is authenticated (receives event.locals)
 * @returns {import('@sveltejs/kit').RequestHandler}
 *
 * @example
 * // In src/routes/auth/[provider]/+server.ts
 * import { createLoginHandler } from '@goobits/auth/handlers';
 * import { GoogleProvider, AppleProvider } from '@goobits/auth/providers';
 *
 * const googleProvider = new GoogleProvider({
 *   clientId: env.GOOGLE_CLIENT_ID,
 *   clientSecret: env.GOOGLE_CLIENT_SECRET,
 *   callbackUrl: `${APP_URL}/auth/google/callback`
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
		allowedReturnToOrigins = [],
		providers,
		redirectAfterLogin = '/',
		secureCookies = true,
		isAuthenticated = (locals: AuthLocals) => !!locals.user
	} = config

	return async({ cookies, params, locals, url }: RequestEventLike) => {
		const returnTo = resolveSafeReturnTo({
			allowedOrigins: allowedReturnToOrigins,
			requestUrl: url,
			returnTo: url.searchParams.get('returnTo')
		})

		// Check if already authenticated
		if (isAuthenticated(locals)) {
			throw redirect(302, returnTo ?? redirectAfterLogin)
		}

		const providerName = String(params['provider'] ?? '')
		const providerConfig = providers[providerName]

		if (!providerConfig) {
			return new Response('Invalid OAuth provider', { status: 400 })
		}

		const { provider, scopes } = providerConfig

		// Generate state and code verifier cookies
		const { state, codeVerifier } = createOAuthCookies(
			cookies,
			providerName,
			{ secure: secureCookies, sameSite: 'lax', returnTo }
		)

		// Create authorization URL
		const authUrl = provider.createAuthorizationURL(
			state,
			codeVerifier,
			scopes || []
		)

		// Special handling for Apple
		if (providerName === 'apple') {
			authUrl.searchParams.set('response_mode', 'form_post')
		}

		throw redirect(302, authUrl)
	}
}
