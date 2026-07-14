import { redirect } from '@sveltejs/kit'

import type { UserAdapter } from '../adapters/database/UserAdapter.ts'
import type { SessionAdapter } from '../adapters/session/SessionAdapter.ts'
import type { CredentialsProvider } from '../providers/CredentialsProvider.ts'
import type { RequestEventLike } from '../types/auth.ts'
import type { SessionMetadata, User } from '../types/index.ts'
import { getLogger } from '../utils/logger.ts'
import { isSafeRedirectPath } from '../utils/redirect.ts'
import { sanitizeUser as defaultSanitizeUser } from '../utils/sanitize.ts'
import { beginMfaLoginChallenge, type MfaLoginConfig } from './mfa.ts'

type RateLimitConfig = {
	check?: (key: string) => Promise<{ allowed: boolean }>
	key?: (event: RequestEventLike) => string
	trustProxyHeader?: boolean
}

function getRateLimitKey(event: RequestEventLike, rateLimit?: RateLimitConfig) {
	if (rateLimit?.key) return rateLimit.key(event)
	if (rateLimit?.trustProxyHeader) {
		const forwardedFor = event.request.headers.get('x-forwarded-for')
		const firstForwardedIp = forwardedFor?.split(',')[0]?.trim()
		if (firstForwardedIp) return firstForwardedIp
	}
	if (event.getClientAddress) return event.getClientAddress()
	return 'unknown'
}

/**
 * Create a signin handler for credentials-based authentication
 * @param {Object} config - Handler configuration
 * @param {import('../providers/CredentialsProvider.ts').CredentialsProvider} config.credentialsProvider - Credentials provider
 * @param {import('../adapters/database/UserAdapter.ts').UserAdapter} config.userAdapter - User adapter
 * @param {import('../adapters/session/SessionAdapter.ts').SessionAdapter} config.sessionAdapter - Session adapter
 * @param {Function} [config.onSignin] - Callback after successful signin (user) => Promise<void>
 * @param {Object} [config.csrf] - CSRF validation config
 * @param {Function} [config.csrf.validate] - Async function (event) => boolean
 * @param {string} [config.csrf.errorMessage] - Error message for invalid CSRF
 * @param {Object} [config.rateLimit] - Rate limit config
 * @param {Function} [config.rateLimit.check] - Async function (key) => { allowed }
 * @param {Function} [config.rateLimit.key] - Function (event) => string for rate limit key
 * @param {string} [config.redirectTo] - Redirect URL after signin (default: '/')
 * @param {Object} [config.fields] - Form field names (identifier, email, password, remember)
 * @param {string} [config.identifierField] - Identifier field (e.g. 'nickname')
 * @param {boolean} [config.allowBoth] - Allow email + identifier fallback
 * @returns {Function} SvelteKit request handler
 */
export function createSigninHandler(config: {
	credentialsProvider: Pick<CredentialsProvider, 'authenticate'>
	userAdapter: UserAdapter
	sessionAdapter: SessionAdapter
	onSignin?: (user: User | null) => Promise<void> | void
	csrf?: { validate?: (event: RequestEventLike) => Promise<boolean>; errorMessage?: string }
	rateLimit?: RateLimitConfig
	redirectTo?: string
	sanitizeUser?: (user: User | null) => User | null
	fields?: { identifier?: string; email?: string; password?: string; remember?: string }
	identifierField?: string
	allowBoth?: boolean
	mfa?: MfaLoginConfig
	getSessionMetadata?: (
		event: RequestEventLike,
		user: User,
		rememberMe: boolean
	) => SessionMetadata | Promise<SessionMetadata>
}) {
	const {
		credentialsProvider,
		userAdapter,
		sessionAdapter,
		onSignin,
		csrf,
		rateLimit,
		redirectTo = '/',
		sanitizeUser = defaultSanitizeUser,
		fields,
		identifierField,
		allowBoth,
		mfa,
		getSessionMetadata
	} = config

	const log = getLogger()

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
			const key = getRateLimitKey(event, rateLimit)
			const result = await rateLimit.check(key)
			if (!result?.allowed) {
				return {
					error: 'Too many attempts. Try again later.',
					success: false
				}
			}
		}

		const formData = await event.request.formData()
		const identifierFieldName = fields?.identifier ?? identifierField ?? fields?.email ?? 'email'
		const emailFieldName = fields?.email ?? 'email'
		const passwordFieldName = fields?.password ?? 'password'
		const rememberFieldName = fields?.remember ?? 'remember'

		const identifier = formData.get(identifierFieldName)?.toString()
		const email = formData.get(emailFieldName)?.toString()
		const password = formData.get(passwordFieldName)?.toString()
		const remember =
			formData.get(rememberFieldName)?.toString() === 'on' ||
			formData.get(rememberFieldName)?.toString() === 'true'

		if ((!identifier && !email) || !password) {
			return {
				error: 'Email and password are required',
				success: false
			}
		}

		try {
			// Authenticate user
			const authInput: {
				email?: string
				identifier?: string
				identifierField?: string
				allowBoth?: boolean
				password: string
				userAdapter: UserAdapter
			} = {
				password,
				userAdapter
			}
			if (email) authInput.email = email
			if (identifier) authInput.identifier = identifier
			if (identifierField) authInput.identifierField = identifierField
			if (allowBoth !== undefined) authInput.allowBoth = allowBoth

			const { user, valid } = await credentialsProvider.authenticate(authInput)

			if (!valid || !user) {
				return {
					error: 'Invalid email or password',
					success: false
				}
			}

			const safeUser = sanitizeUser(user) as User | null
			const sessionMetadata: SessionMetadata = { rememberMe: remember }
			const ip = event.getClientAddress?.()
			if (ip) sessionMetadata['ip'] = ip
			const userAgent = event.request.headers.get('user-agent')
			if (userAgent) sessionMetadata['userAgent'] = userAgent
			if (getSessionMetadata) {
				Object.assign(sessionMetadata, await getSessionMetadata(event, user, remember))
			}
			if (mfa) {
				const challenge = await beginMfaLoginChallenge({
					event,
					user,
					sessionMetadata,
					config: mfa
				})
				if (challenge.handled) return challenge.response
			}

			// Call onSignin hook if provided
			if (onSignin) {
				await onSignin(safeUser)
			}

			// Create session
			const session = await sessionAdapter.createSession(user.id, sessionMetadata)
			sessionAdapter.setSessionCookie(event.cookies, session)

			// Redirect if configured
			if (redirectTo) {
				throw redirect(303, isSafeRedirectPath(redirectTo) ? redirectTo : '/')
			}

			return {
				success: true,
				user: safeUser
			}
		} catch (error) {
			log.error?.('[Signin] Error:', error instanceof Error ? error.message : String(error))

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
				error: 'An error occurred during signin',
				success: false
			}
		}
	}
}
