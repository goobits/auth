/**
 * Create a password reset request handler
 * @param {Object} config - Handler configuration
 * @param {import('../adapters/database/UserAdapter.ts').UserAdapter} config.userAdapter - User adapter
 * @param {import('../adapters/verification-token/VerificationTokenAdapter.ts').VerificationTokenAdapter} config.verificationTokenAdapter - Verification token adapter
 * @param {Function} config.sendPasswordResetEmail - Function to send reset email (email, token) => Promise<void>
 * @param {Object} [config.csrf] - CSRF validation config
 * @param {Function} [config.csrf.validate] - Async function (event) => boolean
 * @param {string} [config.csrf.errorMessage] - Error message for invalid CSRF
 * @param {Object} [config.rateLimit] - Rate limit config
 * @param {Function} [config.rateLimit.check] - Async function (key) => { allowed }
 * @param {Function} [config.rateLimit.key] - Function (event) => string for rate limit key
 * @returns {Function} SvelteKit request handler
 */
import type { VerificationTokenAdapter } from '../adapters/verification-token/VerificationTokenAdapter.ts'
import type { UserAdapter } from '../adapters/database/UserAdapter.ts'
import type { CredentialsProvider } from '../providers/CredentialsProvider.ts'
import type { RequestEventLike } from '../types/auth.ts'
import type { User } from '../types/index.ts'
import { getLogger } from '../utils/logger.ts'
import { isSafeRedirectPath } from '../utils/redirect.ts'

type RateLimitConfig = {
	check?: (key: string) => Promise<{ allowed: boolean }>;
	key?: (event: RequestEventLike) => string;
	trustProxyHeader?: boolean;
}

/** Creates password reset request handler for auth HTTP handlers. */
export function createPasswordResetRequestHandler(config: {
	userAdapter: { getUserByEmail: (email: string) => Promise<User | null> };
	verificationTokenAdapter: VerificationTokenAdapter;
	sendPasswordResetEmail: (email: string, token: string) => Promise<void> | void;
	resolveUser?: (input: {
		email: string;
		identifier: string | null;
		event: RequestEventLike;
	}) => Promise<User | null>;
	expiresInMs?: number;
	csrf?: { validate?: (event: RequestEventLike) => Promise<boolean>; errorMessage?: string };
	rateLimit?: RateLimitConfig;
}) {
	const {
		userAdapter,
		verificationTokenAdapter,
		sendPasswordResetEmail,
		resolveUser,
		expiresInMs,
		csrf,
		rateLimit
	} = config

	const log = getLogger()

	return async(event: RequestEventLike) => {
		if (csrf?.validate) {
			const valid = await csrf.validate(event)
			if (!valid) {
				return {
					error: csrf.errorMessage || 'Invalid CSRF token',
					success: false
				}
			}
		}

		if (rateLimit?.check) {
			const forwardedFor = rateLimit?.trustProxyHeader
				? event.request.headers.get('x-forwarded-for')
				: null
			const firstForwardedIp = forwardedFor?.split(',')[0]?.trim()
			const key = rateLimit.key
				? rateLimit.key(event)
				: firstForwardedIp || event.getClientAddress?.() || 'unknown'
			const result = await rateLimit.check(key)
			if (!result?.allowed) {
				return {
					error: 'Too many attempts. Try again later.',
					success: false
				}
			}
		}

		const formData = await event.request.formData()
		const email = formData.get('email')?.toString()
		const identifier = formData.get('identifier')?.toString().trim() || null

		if (!email) {
			return {
				error: 'Email is required',
				success: false
			}
		}

		try {
			const user = resolveUser
				? await resolveUser({ email, identifier, event })
				: await userAdapter.getUserByEmail(email)
			if (!user) {
				// Don't reveal that user doesn't exist (security)
				return {
					success: true,
					message:
						'If an account exists with this email, a password reset link has been sent'
				}
			}

			// Create reset token
			const { createVerificationToken, VERIFICATION_TOKEN_TYPES } =
				await import('../utils/tokens.ts')

			const tokenInput: Parameters<typeof createVerificationToken>[0] = {
				adapter: verificationTokenAdapter,
				userId: user.id,
				type: VERIFICATION_TOKEN_TYPES.PASSWORD_RESET
			}
			if (expiresInMs !== undefined) tokenInput.expiresInMs = expiresInMs
			const token = await createVerificationToken(tokenInput)

			// Send reset email
			await sendPasswordResetEmail(user.email, token)

			return {
				success: true,
				message:
					'If an account exists with this email, a password reset link has been sent'
			}
		} catch(error) {
			log.error?.('[Password Reset Request] Error:', error instanceof Error ? error.message : String(error))

			return {
				error: 'An error occurred while processing your request',
				success: false
			}
		}
	}
}

/**
 * Create a password reset confirmation handler
 * @param {Object} config - Handler configuration
 * @param {import('../providers/CredentialsProvider.ts').CredentialsProvider} config.credentialsProvider - Credentials provider
 * @param {import('../adapters/database/UserAdapter.ts').UserAdapter} config.userAdapter - User adapter
 * @param {import('../adapters/verification-token/VerificationTokenAdapter.ts').VerificationTokenAdapter} config.verificationTokenAdapter - Verification token adapter
 * @param {import('../adapters/session/SessionAdapter.ts').SessionAdapter} [config.sessionAdapter] - Session adapter (optional)
 * @param {string} [config.redirectTo] - Redirect URL after reset (default: '/sign-in')
 * @returns {Function} SvelteKit request handler
 */
export function createPasswordResetConfirmHandler(config: {
	credentialsProvider: Pick<CredentialsProvider, 'createPasswordHash' | 'updatePassword'>;
	userAdapter: UserAdapter;
	verificationTokenAdapter: VerificationTokenAdapter;
	sessionAdapter?: { invalidateUserSessions?: (userId: string) => Promise<void> };
	completePasswordReset?: (input: {
		token: string;
		passwordHash: string;
	}) => Promise<{ userId: string } | null>;
	redirectTo?: string;
}) {
	const {
		credentialsProvider,
		userAdapter,
		verificationTokenAdapter,
		sessionAdapter,
		completePasswordReset,
		redirectTo = '/sign-in'
	} = config

	const log = getLogger()

	return async(event: RequestEventLike) => {
		const formData = await event.request.formData()
		const token = formData.get('token')?.toString()
		const newPassword = formData.get('password')?.toString()

		if (!token || !newPassword) {
			return {
				error: 'Token and new password are required',
				success: false
			}
		}

		try {
			if (completePasswordReset) {
				if (!credentialsProvider.createPasswordHash) {
					throw new Error('Atomic password reset requires createPasswordHash')
				}
				const passwordHash = await credentialsProvider.createPasswordHash(newPassword)
				const completed = await completePasswordReset({ token, passwordHash })
				if (!completed) {
					return { error: 'Invalid or expired reset token', success: false }
				}
				return {
					success: true,
					message: 'Password has been reset successfully',
					sessionsInvalidated: true,
					redirectTo: isSafeRedirectPath(redirectTo) ? redirectTo : '/sign-in'
				}
			}

			// Consume token and get user
			const { consumeVerificationToken, VERIFICATION_TOKEN_TYPES } =
				await import('../utils/tokens.ts')

			const user = (await consumeVerificationToken({
				adapter: verificationTokenAdapter,
				token,
				type: VERIFICATION_TOKEN_TYPES.PASSWORD_RESET
			})) as User | null

			if (!user) {
				return {
					error: 'Invalid or expired reset token',
					success: false
				}
			}

			// Update password
			await credentialsProvider.updatePassword({
				userId: user.id,
				newPassword,
				userAdapter
			})

			// Invalidate existing sessions after password reset. If this fails,
			// the user's pre-reset sessions remain valid — that's a security
			// regression, so we surface a warning instead of silently swallowing.
			let sessionsInvalidated = true
			if (sessionAdapter?.invalidateUserSessions) {
				try {
					await sessionAdapter.invalidateUserSessions(user.id)
				} catch(error) {
					sessionsInvalidated = false
					log.error?.(
						'[PasswordReset] Failed to invalidate existing sessions after reset:',
						error instanceof Error ? error.message : String(error)
					)
				}
			}

			return {
				success: true,
				message: sessionsInvalidated
					? 'Password has been reset successfully'
					: 'Password reset, but existing sessions could not be invalidated. Sign out from all devices manually.',
				sessionsInvalidated,
				redirectTo: isSafeRedirectPath(redirectTo) ? redirectTo : '/sign-in'
			}
		} catch(error) {
			log.error?.('[Password Reset Confirm] Error:', error instanceof Error ? error.message : String(error))

			return {
				error:
					(error instanceof Error ? error.message : undefined) ||
					'An error occurred while resetting password',
				success: false
			}
		}
	}
}
