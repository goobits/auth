import { isRedirect, redirect } from '@sveltejs/kit'

import type { PasswordCredentialAdapter } from '../adapters/database/PasswordCredentialAdapter.ts'
import type { SessionAdapter } from '../adapters/session/SessionAdapter.ts'
import { errorContext, resolveLogger, type Logger } from '../_internal/logger.ts'
import type { CredentialsProvider } from '../providers/CredentialsProvider.ts'
import type { RequestEventLike } from '../types/auth.ts'
import type { SessionMetadata, User } from '../types/index.ts'
import { isSafeRedirectPath } from '../utils/redirect.ts'
import { readRequestFormData } from '../utils/http.ts'
import { sanitizeUser as defaultSanitizeUser } from '../utils/sanitize.ts'
import { beginMfaLoginChallenge } from './mfaLogin.ts'
import type { MfaLoginConfig } from './_mfaTypes.ts'
import type { HandlerRateLimitConfig } from './rateLimitKey.ts'
import {
	createStandaloneSecurityGate,
	type StandaloneSecurityBoundary
} from './_standaloneSecurity.ts'

/**
 * Create a signin handler for credentials-based authentication
 * @param {Object} config - Handler configuration
 * @param {import('../providers/CredentialsProvider.ts').CredentialsProvider} config.credentialsProvider - Credentials provider
 * @param {import('../adapters/database/UserAdapter.ts').UserAdapter} config.userAdapter - User adapter
 * @param {import('../adapters/session/SessionAdapter.ts').SessionAdapter} config.sessionAdapter - Session adapter
 * @param {Function} [config.onSignin] - Callback after successful credential validation
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
export type SigninHookContext = {
	event: RequestEventLike
	formData: FormData
	rememberMe: boolean
	sessionMetadata: SessionMetadata
}

export type SigninDeniedResult = {
	allowed: false
	error: string
	code?: string
	status?: number
}

export type SigninHookResult = SigninDeniedResult | void

export function createSigninHandler(
	config: {
		credentialsProvider: Pick<CredentialsProvider, 'authenticate'>
		passwordCredentialAdapter: PasswordCredentialAdapter
		sessionAdapter: SessionAdapter
		onSignin?: (
			user: User | null,
			context: SigninHookContext
		) => Promise<SigninHookResult> | SigninHookResult
		authorizeSignin?: (
			user: User,
			context: SigninHookContext
		) => Promise<SigninHookResult> | SigninHookResult
		csrf?: { validate?: (event: RequestEventLike) => Promise<boolean>; errorMessage?: string }
		rateLimit?: HandlerRateLimitConfig
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
		logger?: Logger
	} & StandaloneSecurityBoundary
) {
	const validateRequestSecurity = createStandaloneSecurityGate('createSigninHandler', config)
	const {
		credentialsProvider,
		passwordCredentialAdapter,
		sessionAdapter,
		onSignin,
		authorizeSignin,
		redirectTo = '/',
		sanitizeUser = defaultSanitizeUser,
		fields,
		identifierField,
		allowBoth,
		mfa,
		getSessionMetadata,
		logger
	} = config

	const log = resolveLogger(logger)

	return async (event: RequestEventLike) => {
		const securityFailure = await validateRequestSecurity(event)
		if (securityFailure) return securityFailure

		const formData = await readRequestFormData(event.request)
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
				passwordCredentialAdapter: PasswordCredentialAdapter
			} = {
				password,
				passwordCredentialAdapter
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
			const sessionMetadata: SessionMetadata = getSessionMetadata
				? { ...(await getSessionMetadata(event, user, remember)) }
				: {}
			delete sessionMetadata.mfaVerifiedAt
			delete sessionMetadata.createdAt
			sessionMetadata.rememberMe = remember
			const ip = event.getClientAddress?.()
			if (ip) sessionMetadata['ip'] = ip
			const userAgent = event.request.headers.get('user-agent')
			if (userAgent) sessionMetadata['userAgent'] = userAgent
			const hookContext: SigninHookContext = {
				event,
				formData,
				rememberMe: remember,
				sessionMetadata: { ...sessionMetadata }
			}
			const authorization = await authorizeSignin?.(user, hookContext)
			if (authorization?.allowed === false) {
				return {
					error: authorization.error,
					success: false,
					...(authorization.code ? { code: authorization.code } : {}),
					...(authorization.status ? { status: authorization.status } : {})
				}
			}
			if (mfa) {
				const challenge = await beginMfaLoginChallenge({
					event,
					user,
					sessionMetadata,
					redirectTo,
					config: mfa
				})
				if (challenge.handled) return challenge.response
			}

			// Call onSignin hook if provided
			if (onSignin) {
				const hookResult = await onSignin(safeUser, hookContext)
				if (hookResult?.allowed === false) {
					return {
						error: hookResult.error,
						success: false,
						...(hookResult.code ? { code: hookResult.code } : {}),
						...(hookResult.status ? { status: hookResult.status } : {})
					}
				}
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
			if (isRedirect(error)) throw error
			log.error('[Signin] Error', errorContext(error))

			return {
				error: 'An error occurred during signin',
				success: false
			}
		}
	}
}
