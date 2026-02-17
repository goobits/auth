/**
 * Create a password reset request handler
 * @param {Object} config - Handler configuration
 * @param {import('../adapters/database/base.js').UserAdapter} config.userAdapter - User adapter
 * @param {import('../adapters/verification-token/base.js').VerificationTokenAdapter} config.verificationTokenAdapter - Verification token adapter
 * @param {Function} config.sendPasswordResetEmail - Function to send reset email (email, token) => Promise<void>
 * @param {Object} [config.csrf] - CSRF validation config
 * @param {Function} [config.csrf.validate] - Async function (event) => boolean
 * @param {string} [config.csrf.errorMessage] - Error message for invalid CSRF
 * @param {Object} [config.rateLimit] - Rate limit config
 * @param {Function} [config.rateLimit.check] - Async function (key) => { allowed }
 * @param {Function} [config.rateLimit.key] - Function (event) => string for rate limit key
 * @returns {Function} SvelteKit request handler
 */
import type { RequestEventLike } from "../types/auth.js";
import { getLogger } from "../utils/logger.js";
import type { User } from "../types/index.js";
import type { VerificationTokenAdapter } from "../adapters/verification-token/base.js";

type RateLimitConfig = {
	check?: (key: string) => Promise<{ allowed: boolean }>;
	key?: (event: RequestEventLike) => string;
	trustProxyHeader?: boolean;
};

export function createPasswordResetRequestHandler(config: {
	userAdapter: { getUserByEmail: (email: string) => Promise<User | null> };
	verificationTokenAdapter: VerificationTokenAdapter;
	sendPasswordResetEmail: (email: string, token: string) => Promise<void> | void;
	csrf?: { validate?: (event: RequestEventLike) => Promise<boolean>; errorMessage?: string };
	rateLimit?: RateLimitConfig;
}) {
	const {
		userAdapter,
		verificationTokenAdapter,
		sendPasswordResetEmail,
		csrf,
		rateLimit,
	} = config;

	const log = getLogger();

	return async (event: RequestEventLike) => {
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
					: rateLimit?.trustProxyHeader
						? event.request.headers.get("x-forwarded-for") || "unknown"
						: "unknown";
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
			log.error?.("[Password Reset Request] Error:", error);

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
 * @param {import('../adapters/database/base.js').UserAdapter} config.userAdapter - User adapter
 * @param {import('../adapters/verification-token/base.js').VerificationTokenAdapter} config.verificationTokenAdapter - Verification token adapter
 * @param {import('../adapters/session/base.js').SessionAdapter} [config.sessionAdapter] - Session adapter (optional)
 * @param {string} [config.redirectTo] - Redirect URL after reset (default: '/sign-in')
 * @returns {Function} SvelteKit request handler
 */
export function createPasswordResetConfirmHandler(config: {
	credentialsProvider: {
		updatePassword: (input: {
			userId: string;
			newPassword: string;
			userAdapter: unknown;
		}) => Promise<void>;
	};
	userAdapter: unknown;
	verificationTokenAdapter: VerificationTokenAdapter;
	sessionAdapter?: { invalidateUserSessions?: (userId: string) => Promise<void> };
	redirectTo?: string;
}) {
	const {
		credentialsProvider,
		userAdapter,
		verificationTokenAdapter,
		sessionAdapter,
		redirectTo = "/sign-in",
	} = config;

	const log = getLogger();

	return async (event: RequestEventLike) => {
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

			const user = (await consumeVerificationToken({
				adapter: verificationTokenAdapter,
				token,
				type: VERIFICATION_TOKEN_TYPES.PASSWORD_RESET,
			})) as User | null;

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

			// Invalidate existing sessions after password reset
			if (sessionAdapter?.invalidateUserSessions) {
				try {
					await sessionAdapter.invalidateUserSessions(user.id);
				} catch {}
			}

			return {
				success: true,
				message: "Password has been reset successfully",
				redirectTo,
			};
		} catch (error) {
			log.error?.("[Password Reset Confirm] Error:", error);

			return {
				error:
					(error instanceof Error ? error.message : undefined) ||
					"An error occurred while resetting password",
				success: false,
			};
		}
	};
}
