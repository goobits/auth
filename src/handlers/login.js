import { redirect } from "@sveltejs/kit";
import { createOAuthCookies } from "../utils/oauth.js";

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
 * // In src/routes/auth/[provider]/+server.js
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
export function createLoginHandler(config) {
	const {
		providers,
		redirectAfterLogin = "/",
		secureCookies = true,
		isAuthenticated = (locals) => !!locals.user,
	} = config;

	return async ({ cookies, params, locals, url }) => {
		// Check if already authenticated
		if (isAuthenticated(locals)) {
			throw redirect(302, redirectAfterLogin);
		}

		const providerName = params.provider;
		const providerConfig = providers[providerName];

		if (!providerConfig) {
			return new Response("Invalid OAuth provider", { status: 400 });
		}

		const { provider, scopes } = providerConfig;

		// Generate state and code verifier cookies
		const { state, codeVerifier } = createOAuthCookies(
			cookies,
			providerName,
			{ secure: secureCookies },
		);

		// Create authorization URL
		const authUrl = provider.createAuthorizationURL(
			state,
			codeVerifier,
			scopes,
		);

		// Special handling for Apple
		if (providerName === "apple") {
			authUrl.searchParams.set("response_mode", "form_post");
		}

		throw redirect(302, authUrl);
	};
}
