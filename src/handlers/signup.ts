import { redirect } from '@sveltejs/kit'

import type { VerificationTokenAdapter } from '../adapters/verification-token/VerificationTokenAdapter.ts'
import type { PasswordCredentialAdapter } from '../adapters/database/PasswordCredentialAdapter.ts'
import { errorContext, resolveLogger, type Logger } from '../_internal/logger.ts'
import type { RequestEventLike } from '../types/auth.ts'
import type { User } from '../types/index.ts'
import { isSafeRedirectPath } from '../utils/redirect.ts'
import { sanitizeUser as defaultSanitizeUser } from '../utils/sanitize.ts'
import { createVerificationToken, VERIFICATION_TOKEN_TYPES } from '../verification/index.ts'
import { resolveHandlerRateLimitKey, type HandlerRateLimitConfig } from './rateLimitKey.ts'

/**
 * Create a signup handler for credentials-based authentication
 * @param {Object} config - Handler configuration
 * @param {import('../providers/CredentialsProvider.ts').CredentialsProvider} config.credentialsProvider - Credentials provider
 * @param {import('../adapters/database/UserAdapter.ts').UserAdapter} config.userAdapter - User adapter
 * @param {import('../adapters/session/SessionAdapter.ts').SessionAdapter} config.sessionAdapter - Session adapter
 * @param {import('../adapters/verification-token/VerificationTokenAdapter.ts').VerificationTokenAdapter} [config.verificationTokenAdapter] - Verification token adapter (optional)
 * @param {Function} [config.onSignup] - Callback after user creation (user) => Promise<void>
 * @param {Function} [config.sendVerificationEmail] - Function to send verification email (email, token) => Promise<void>
 * @param {Object} [config.csrf] - CSRF validation config
 * @param {Function} [config.csrf.validate] - Async function (event) => boolean
 * @param {string} [config.csrf.errorMessage] - Error message for invalid CSRF
 * @param {Object} [config.rateLimit] - Rate limit config
 * @param {Function} [config.rateLimit.check] - Async function (key) => { allowed }
 * @param {Function} [config.rateLimit.key] - Function (event) => string for rate limit key
 * @param {string} [config.redirectTo] - Redirect URL after signup (default: '/')
 * @param {boolean} [config.autoLogin] - Automatically log in after signup. Defaults to false when email verification is configured.
 * @param {Object} [config.fields] - Form field names (email, password, name)
 * @param {string[]} [config.metadataFields] - Form fields to pass as metadata to createUser
 * @param {Function} [config.getSignupMetadata] - Compute additional metadata from FormData
 * @returns {Function} SvelteKit request handler
 */
export function createSignupHandler(config: {
	credentialsProvider: {
		signUp: (input: {
			email: string
			password: string
			name?: string
			metadata?: Record<string, unknown>
			passwordCredentialAdapter: PasswordCredentialAdapter
		}) => Promise<User>
	}
	userAdapter: { getUserByEmail: (email: string) => Promise<User | null> }
	passwordCredentialAdapter: PasswordCredentialAdapter
	sessionAdapter?: {
		createSession: (userId: string) => Promise<{ id: string; expiresAt: Date }>
		setSessionCookie: (
			cookies: RequestEventLike['cookies'],
			session: { id: string; expiresAt: Date }
		) => void
	}
	verificationTokenAdapter?: VerificationTokenAdapter
	onSignup?: (user: User | null) => Promise<void> | void
	sendVerificationEmail?: (email: string, token: string) => Promise<void> | void
	csrf?: { validate?: (event: RequestEventLike) => Promise<boolean>; errorMessage?: string }
	rateLimit?: HandlerRateLimitConfig
	redirectTo?: string
	autoLogin?: boolean
	sanitizeUser?: (user: User | null) => User | null
	fields?: { email?: string; password?: string; name?: string }
	metadataFields?: string[]
	getSignupMetadata?: (
		formData: FormData
	) => Record<string, unknown> | Promise<Record<string, unknown>>
	logger?: Logger
}) {
	const {
		credentialsProvider,
		userAdapter,
		passwordCredentialAdapter,
		sessionAdapter,
		verificationTokenAdapter,
		onSignup,
		sendVerificationEmail,
		csrf,
		rateLimit,
		redirectTo = '/',
		autoLogin,
		sanitizeUser = defaultSanitizeUser,
		fields,
		metadataFields,
		getSignupMetadata,
		logger
	} = config

	const log = resolveLogger(logger)
	const shouldAutoLogin =
		autoLogin ?? !(verificationTokenAdapter !== undefined && sendVerificationEmail !== undefined)

	return async (event: RequestEventLike) => {
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
			const key = resolveHandlerRateLimitKey(event, rateLimit)
			const result = await rateLimit.check(key)
			if (!result?.allowed) {
				return {
					error: 'Too many attempts. Try again later.',
					success: false
				}
			}
		}

		const formData = await event.request.formData()
		const emailFieldName = fields?.email ?? 'email'
		const passwordFieldName = fields?.password ?? 'password'
		const nameFieldName = fields?.name ?? 'name'

		const email = formData.get(emailFieldName)?.toString()
		const password = formData.get(passwordFieldName)?.toString()
		const name = formData.get(nameFieldName)?.toString()

		if (!email || !password) {
			return {
				error: 'Email and password are required',
				success: false
			}
		}

		try {
			// Check if user already exists
			const existingUser = await userAdapter.getUserByEmail(email)
			if (existingUser) {
				return {
					error: 'Unable to create account with those details',
					success: false
				}
			}

			// Create user
			const signUpInput: {
				email: string
				password: string
				name?: string
				metadata?: Record<string, unknown>
				passwordCredentialAdapter: PasswordCredentialAdapter
			} = {
				email,
				password,
				passwordCredentialAdapter
			}
			if (name) signUpInput.name = name
			if (metadataFields?.length) {
				signUpInput.metadata = {}
				for (const field of metadataFields) {
					const value = formData.get(field)
					if (typeof value === 'string' && value.trim().length > 0) {
						signUpInput.metadata[field] = value
					}
				}
			}
			if (getSignupMetadata) {
				const extra = await getSignupMetadata(formData)
				signUpInput.metadata = {
					...(signUpInput.metadata ?? {}),
					...extra
				}
			}
			const user = await credentialsProvider.signUp(signUpInput)

			const safeUser = sanitizeUser(user) as User | null

			// Call onSignup hook if provided
			if (onSignup) {
				await onSignup(safeUser)
			}

			// Send verification email if adapter and sender provided
			if (verificationTokenAdapter && sendVerificationEmail) {
				try {
					const token = await createVerificationToken({
						adapter: verificationTokenAdapter,
						userId: user.id,
						type: VERIFICATION_TOKEN_TYPES.EMAIL_VERIFICATION
					})

					await sendVerificationEmail(user.email, token)
				} catch (emailError) {
					log.error('[Signup] Failed to send verification email', errorContext(emailError))

					// Don't fail signup if email fails
				}
			}

			// Auto-login if enabled
			if (shouldAutoLogin && sessionAdapter) {
				const session = await sessionAdapter.createSession(user.id)
				sessionAdapter.setSessionCookie(event.cookies, session)
			}

			// Redirect if configured
			if (redirectTo) {
				throw redirect(303, isSafeRedirectPath(redirectTo) ? redirectTo : '/')
			}

			return {
				success: true,
				user: safeUser
			}
		} catch (error) {
			log.error('[Signup] Error', errorContext(error))

			// Check if this is a redirect (don't treat as error)
			if (
				error &&
				typeof error === 'object' &&
				'status' in error &&
				((error as { status?: number }).status === 302 ||
					(error as { status?: number }).status === 303)
			) {
				throw error
			}

			return {
				error: 'An error occurred during signup',
				success: false
			}
		}
	}
}
