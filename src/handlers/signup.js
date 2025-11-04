import { redirect } from "@sveltejs/kit";

/**
 * Create a signup handler for credentials-based authentication
 * @param {Object} config - Handler configuration
 * @param {import('../providers/credentials.js').CredentialsProvider} config.credentialsProvider - Credentials provider
 * @param {import('../adapters/database/base.js').DatabaseAdapter} config.userAdapter - User adapter
 * @param {import('../adapters/session/base.js').SessionAdapter} config.sessionAdapter - Session adapter
 * @param {import('../utils/tokens.js').VerificationTokenAdapter} [config.verificationTokenAdapter] - Verification token adapter (optional)
 * @param {Function} [config.onSignup] - Callback after user creation (user) => Promise<void>
 * @param {Function} [config.sendVerificationEmail] - Function to send verification email (email, token) => Promise<void>
 * @param {string} [config.redirectTo] - Redirect URL after signup (default: '/')
 * @param {boolean} [config.autoLogin] - Automatically log in user after signup (default: true)
 * @returns {Function} SvelteKit request handler
 */
export function createSignupHandler(config) {
	const {
		credentialsProvider,
		userAdapter,
		sessionAdapter,
		verificationTokenAdapter,
		onSignup,
		sendVerificationEmail,
		redirectTo = "/",
		autoLogin = true,
	} = config;

	return async (event) => {
		const formData = await event.request.formData();
		const email = formData.get("email")?.toString();
		const password = formData.get("password")?.toString();
		const name = formData.get("name")?.toString();

		if (!email || !password) {
			return {
				error: "Email and password are required",
				success: false,
			};
		}

		try {
			// Check if user already exists
			const existingUser = await userAdapter.getUserByEmail(email);
			if (existingUser) {
				return {
					error: "An account with this email already exists",
					success: false,
				};
			}

			// Create user
			const user = await credentialsProvider.signUp({
				email,
				password,
				name,
				userAdapter,
			});

			// Call onSignup hook if provided
			if (onSignup) {
				await onSignup(user);
			}

			// Send verification email if adapter and sender provided
			if (verificationTokenAdapter && sendVerificationEmail) {
				try {
					const { createVerificationToken, VERIFICATION_TOKEN_TYPES } =
						await import("../utils/tokens.js");

					const token = await createVerificationToken({
						adapter: verificationTokenAdapter,
						userId: user.id,
						type: VERIFICATION_TOKEN_TYPES.EMAIL_VERIFICATION,
					});

					await sendVerificationEmail(user.email, token);
				} catch (emailError) {
					console.error(
						"[Signup] Failed to send verification email:",
						emailError,
					);
					// Don't fail signup if email fails
				}
			}

			// Auto-login if enabled
			if (autoLogin && sessionAdapter) {
				const session = await sessionAdapter.createSession(user.id);
				sessionAdapter.setSessionCookie(event.cookies, session);
			}

			// Redirect if configured
			if (redirectTo) {
				throw redirect(303, redirectTo);
			}

			return {
				success: true,
				user,
			};
		} catch (error) {
			console.error("[Signup] Error:", error);

			// Check if this is a redirect (don't treat as error)
			if (error?.status === 302 || error?.status === 303) {
				throw error;
			}

			return {
				error: error.message || "An error occurred during signup",
				success: false,
			};
		}
	};
}
