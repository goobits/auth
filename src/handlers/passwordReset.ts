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
import type { CredentialsProvider } from '../providers/CredentialsProvider.ts'
import type { RequestEventLike } from '../types/auth.ts'
import type { User } from '../types/index.ts'
import { errorContext, resolveLogger, type Logger } from '../_internal/logger.ts'
import { isSafeRedirectPath } from '../utils/redirect.ts'
import { readRequestFormData } from '../utils/http.ts'
import {
	createVerificationToken,
	hashVerificationToken,
	VERIFICATION_TOKEN_TYPES
} from '../verification/index.ts'
import type { HandlerRateLimitConfig } from './rateLimitKey.ts'
import {
	createStandaloneSecurityGate,
	type StandaloneSecurityBoundary
} from './_standaloneSecurity.ts'

/** Creates password reset request handler for auth HTTP handlers. */
export function createPasswordResetRequestHandler(
	config: {
		userAdapter: { getUserByEmail: (email: string) => Promise<User | null> }
		verificationTokenAdapter: VerificationTokenAdapter
		sendPasswordResetEmail: (email: string, token: string) => Promise<void> | void
		resolveUser?: (input: {
			email: string
			identifier: string | null
			event: RequestEventLike
		}) => Promise<User | null>
		expiresInMs?: number
		csrf?: { validate?: (event: RequestEventLike) => Promise<boolean>; errorMessage?: string }
		rateLimit?: HandlerRateLimitConfig
		logger?: Logger
	} & StandaloneSecurityBoundary
) {
	const validateRequestSecurity = createStandaloneSecurityGate(
		'createPasswordResetRequestHandler',
		config
	)
	const {
		userAdapter,
		verificationTokenAdapter,
		sendPasswordResetEmail,
		resolveUser,
		expiresInMs,
		logger
	} = config

	const log = resolveLogger(logger)

	return async (event: RequestEventLike) => {
		const securityFailure = await validateRequestSecurity(event)
		if (securityFailure) return securityFailure

		const formData = await readRequestFormData(event.request)
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
					message: 'If an account exists with this email, a password reset link has been sent'
				}
			}

			// Create reset token
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
				message: 'If an account exists with this email, a password reset link has been sent'
			}
		} catch (error) {
			log.error('[Password Reset Request] Error', errorContext(error))

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
 * @param {Pick<CredentialsProvider, 'createPasswordHash'>} config.credentialsProvider - Password hasher
 * @param {Function} config.completePasswordReset - Application-owned atomic reset transaction
 * @param {string} [config.redirectTo] - Redirect URL after reset (default: '/sign-in')
 * @returns {Function} SvelteKit request handler
 */
export function createPasswordResetConfirmHandler(
	config: {
		credentialsProvider: Pick<CredentialsProvider, 'createPasswordHash'>
		completePasswordReset: (input: {
			tokenHash: string
			passwordHash: string
		}) => Promise<{ userId: string } | null>
		redirectTo?: string
		csrf?: { validate?: (event: RequestEventLike) => Promise<boolean>; errorMessage?: string }
		rateLimit?: HandlerRateLimitConfig
		logger?: Logger
	} & StandaloneSecurityBoundary
) {
	const validateRequestSecurity = createStandaloneSecurityGate(
		'createPasswordResetConfirmHandler',
		config
	)
	const { credentialsProvider, completePasswordReset, redirectTo = '/sign-in', logger } = config

	const log = resolveLogger(logger)

	return async (event: RequestEventLike) => {
		const securityFailure = await validateRequestSecurity(event)
		if (securityFailure) return securityFailure

		const formData = await readRequestFormData(event.request)
		const token = formData.get('token')?.toString()
		const newPassword = formData.get('password')?.toString()

		if (!token || !newPassword) {
			return {
				error: 'Token and new password are required',
				success: false
			}
		}

		try {
			const passwordHash = await credentialsProvider.createPasswordHash(newPassword)
			const tokenHash = await hashVerificationToken(token)
			const completed = await completePasswordReset({ tokenHash, passwordHash })
			if (!completed) {
				return { error: 'Invalid or expired reset token', success: false }
			}

			return {
				success: true,
				message: 'Password has been reset successfully',
				sessionsInvalidated: true,
				redirectTo: isSafeRedirectPath(redirectTo) ? redirectTo : '/sign-in'
			}
		} catch (error) {
			log.error('[Password Reset Confirm] Error', errorContext(error))

			return {
				error: 'An error occurred while resetting password',
				success: false
			}
		}
	}
}
