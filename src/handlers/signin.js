import { redirect } from "@sveltejs/kit";

/**
 * Create a signin handler for credentials-based authentication
 * @param {Object} config - Handler configuration
 * @param {import('../providers/credentials.js').CredentialsProvider} config.credentialsProvider - Credentials provider
 * @param {import('../adapters/database/base.js').DatabaseAdapter} config.userAdapter - User adapter
 * @param {import('../adapters/session/base.js').SessionAdapter} config.sessionAdapter - Session adapter
 * @param {Function} [config.onSignin] - Callback after successful signin (user) => Promise<void>
 * @param {string} [config.redirectTo] - Redirect URL after signin (default: '/')
 * @returns {Function} SvelteKit request handler
 */
export function createSigninHandler(config) {
	const {
		credentialsProvider,
		userAdapter,
		sessionAdapter,
		onSignin,
		redirectTo = "/",
	} = config;

	return async (event) => {
		const formData = await event.request.formData();
		const email = formData.get("email")?.toString();
		const password = formData.get("password")?.toString();

		if (!email || !password) {
			return {
				error: "Email and password are required",
				success: false,
			};
		}

		try {
			// Authenticate user
			const { user, valid } = await credentialsProvider.authenticate({
				email,
				password,
				userAdapter,
			});

			if (!valid || !user) {
				return {
					error: "Invalid email or password",
					success: false,
				};
			}

			// Call onSignin hook if provided
			if (onSignin) {
				await onSignin(user);
			}

			// Create session
			const session = await sessionAdapter.createSession(user.id);
			sessionAdapter.setSessionCookie(event.cookies, session);

			// Redirect if configured
			if (redirectTo) {
				throw redirect(303, redirectTo);
			}

			return {
				success: true,
				user,
			};
		} catch (error) {
			console.error("[Signin] Error:", error);

			// Check if this is a redirect (don't treat as error)
			if (error?.status === 302 || error?.status === 303) {
				throw error;
			}

			return {
				error: error.message || "An error occurred during signin",
				success: false,
			};
		}
	};
}
