import { redirect, error } from "@sveltejs/kit";
import { OAuth2RequestError } from "arctic";
import { handleOAuthCallback } from "../utils/oauth.js";

/**
 * Create a callback route handler for OAuth providers
 *
 * @param {Object} config - Handler configuration
 * @param {Object.<string, import('../providers/base.js').OAuthProvider>} config.providers - Provider instances mapped by name
 * @param {string} [config.redirectAfterLogin] - URL to redirect to after successful auth
 * @param {Function} [config.isAuthenticated] - Function to check if user is authenticated (receives event.locals)
 * @param {Function} config.onAuthenticated - Called with (event, profile, tokens) after successful auth
 * @param {Function} [config.onError] - Optional error handler, called with (event, error)
 * @returns {import('@sveltejs/kit').RequestHandler}
 *
 * @example
 * // In src/routes/auth/[provider]/callback/+server.js
 * import { createCallbackHandler } from '@goobits/auth/handlers';
 * import { GoogleProvider } from '@goobits/auth/providers';
 *
 * const googleProvider = new GoogleProvider({...});
 *
 * export const GET = createCallbackHandler({
 *   providers: { google: googleProvider },
 *   redirectAfterLogin: '/dashboard',
 *   isAuthenticated: (locals) => !!locals.user,
 *   onAuthenticated: async (event, profile, tokens) => {
 *     // Store tokens, create/update user, start session
 *     const user = await findOrCreateUser(profile);
 *     await sessionAdapter.createSession(user.id);
 *   }
 * });
 */
export function createCallbackHandler(config) {
	const {
		providers,
		redirectAfterLogin = "/",
		isAuthenticated = (locals) => !!locals.user,
		onAuthenticated,
		onError,
	} = config;

	return async (event) => {
		const { params, locals, url } = event;

		try {
			// Already authenticated - redirect
			if (isAuthenticated(locals)) {
				throw redirect(302, redirectAfterLogin);
			}

			const providerName = params.provider;
			const providerInstance = providers[providerName];

			if (!providerInstance) {
				throw error(400, "Invalid OAuth provider");
			}

			// Extract Apple user data if present (POST form data)
			let appleUserData = null;
			if (providerName === "apple" && event.request.method === "POST") {
				const formData = await event.request.formData();
				appleUserData = formData.get("user");
			}

			// Handle OAuth callback
			const profile = await handleOAuthCallback({
				event,
				provider: providerName,
				providerInstance,
				appleUserData,
				callbacks: {
					onAuthenticated: async (userProfile, tokens) => {
						await onAuthenticated(event, userProfile, tokens);
					},
					onError: onError
						? async (err) => await onError(event, err)
						: undefined,
				},
			});

			throw redirect(302, redirectAfterLogin);
		} catch (err) {
			// Handle OAuth2 errors
			if (err instanceof OAuth2RequestError) {
				throw error(400, "OAuth authentication failed");
			}

			// Re-throw redirects and errors
			if (err.status) throw err;

			// Log and throw generic error
			console.error("Authentication error:", err);
			throw error(500, "Authentication system error");
		}
	};
}
