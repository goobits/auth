/**
 * Create a password reset request handler
 * @param {Object} config - Handler configuration
 * @param {import('../adapters/database/base.js').DatabaseAdapter} config.userAdapter - User adapter
 * @param {import('../utils/tokens.js').VerificationTokenAdapter} config.verificationTokenAdapter - Verification token adapter
 * @param {Function} config.sendPasswordResetEmail - Function to send reset email (email, token) => Promise<void>
 * @param {Object} [config.csrf] - CSRF validation config
 * @param {Function} [config.csrf.validate] - Async function (event) => boolean
 * @param {string} [config.csrf.errorMessage] - Error message for invalid CSRF
 * @param {Object} [config.rateLimit] - Rate limit config
 * @param {Function} [config.rateLimit.check] - Async function (key) => { allowed }
 * @param {Function} [config.rateLimit.key] - Function (event) => string for rate limit key
 * @returns {Function} SvelteKit request handler
 */
export function createPasswordResetRequestHandler(config) {
	const {
		userAdapter,
		verificationTokenAdapter,
		sendPasswordResetEmail,
		csrf,
		rateLimit,
	} = config;

	return async (event) => {
		if (csrf?.validate) {
			const valid = await csrf.validate(event);
			if (!valid) {
				return {
					error: csrf.errorMessage || "Invalid CSRF token",
					success: false,
				};
			}
		}

		if (rateLimit?.check) {
			const key = rateLimit.key
				? rateLimit.key(event)
				: event.getClientAddress
					? event.getClientAddress()
					: event.request.headers.get("x-forwarded-for") || "unknown";
			const result = await rateLimit.check(key);
			if (!result?.allowed) {
				return {
					error: "Too many attempts. Try again later.",
					success: false,
				};
			}
		}

		const formData = await event.request.formData();
		const email = formData.get("email")?.toString();

		if (!email) {
			return {
				error: "Email is required",
				success: false,
			};
		}

		try {
			// Check if user exists
			const user = await userAdapter.getUserByEmail(email);
			if (!user) {
				// Don't reveal that user doesn't exist (security)
				return {
					success: true,
					message:
						"If an account exists with this email, a password reset link has been sent",
				};
			}

			// Create reset token
			const { createVerificationToken, VERIFICATION_TOKEN_TYPES } =
				await import("../utils/tokens.js");

			const token = await createVerificationToken({
				adapter: verificationTokenAdapter,
				userId: user.id,
				type: VERIFICATION_TOKEN_TYPES.PASSWORD_RESET,
			});

			// Send reset email
			await sendPasswordResetEmail(user.email, token);

			return {
				success: true,
				message:
					"If an account exists with this email, a password reset link has been sent",
			};
		} catch (error) {
			console.error("[Password Reset Request] Error:", error);

			return {
				error: "An error occurred while processing your request",
				success: false,
			};
		}
	};
}

/**
 * Create a password reset confirmation handler
 * @param {Object} config - Handler configuration
 * @param {import('../providers/credentials.js').CredentialsProvider} config.credentialsProvider - Credentials provider
 * @param {import('../adapters/database/base.js').DatabaseAdapter} config.userAdapter - User adapter
 * @param {import('../utils/tokens.js').VerificationTokenAdapter} config.verificationTokenAdapter - Verification token adapter
 * @param {string} [config.redirectTo] - Redirect URL after reset (default: '/sign-in')
 * @returns {Function} SvelteKit request handler
 */
export function createPasswordResetConfirmHandler(config) {
	const {
		credentialsProvider,
		userAdapter,
		verificationTokenAdapter,
		redirectTo = "/sign-in",
	} = config;

	return async (event) => {
		const formData = await event.request.formData();
		const token = formData.get("token")?.toString();
		const newPassword = formData.get("password")?.toString();

		if (!token || !newPassword) {
			return {
				error: "Token and new password are required",
				success: false,
			};
		}

		try {
			// Consume token and get user
			const { consumeVerificationToken, VERIFICATION_TOKEN_TYPES } =
				await import("../utils/tokens.js");

			const user = await consumeVerificationToken({
				adapter: verificationTokenAdapter,
				token,
				type: VERIFICATION_TOKEN_TYPES.PASSWORD_RESET,
			});

			if (!user) {
				return {
					error: "Invalid or expired reset token",
					success: false,
				};
			}

			// Update password
			await credentialsProvider.updatePassword({
				userId: user.id,
				newPassword,
				userAdapter,
			});

			return {
				success: true,
				message: "Password has been reset successfully",
				redirectTo,
			};
		} catch (error) {
			console.error("[Password Reset Confirm] Error:", error);

			return {
				error: error.message || "An error occurred while resetting password",
				success: false,
			};
		}
	};
}
