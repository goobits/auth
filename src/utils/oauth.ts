import type { Cookies, RequestEvent } from '@sveltejs/kit'
import { bytesToBase64Url, constantTimeEqual, randomBytes } from '@goobits/security/crypto'

import type { OAuthProvider } from '../providers/OAuthProvider.ts'
import type { RequestEventLike } from '../types/auth.ts'
import type { OAuthFlowIntent, OAuthProfile, OAuthTokens } from '../types/index.ts'

type CookiesLike = Pick<Cookies, 'set' | 'get' | 'delete'>

type OAuthCookieOptions = {
	intent: OAuthFlowIntent
	userId: string | null
	redirectTo?: string
	secure?: boolean
	maxAge?: number
	sameSite?: 'lax' | 'strict' | 'none'
}

type OAuthCallbackParams = {
	code: string | null
	state: string | null
	error?: string | null
	errorDescription?: string | null
	storedState: string | null
	storedCodeVerifier: string | null
}

type OAuthCallbackOverrides = {
	code?: string | null
	state?: string | null
	error?: string | null
	errorDescription?: string | null
}

type OAuthCallbackHandlers = {
	onAuthenticated?: (
		profile: OAuthProfile,
		tokens: OAuthTokens,
		context: OAuthFlowContext
	) => Promise<void> | void
	onError?: (error: unknown) => Promise<void> | void
}

export type OAuthFlowContext = {
	intent: OAuthFlowIntent
	userId: string | null
	redirectTo: string
}

export type OAuthCallbackErrorCode = 'cancelled' | 'invalid_callback' | 'provider_rejected'

/** A safe, typed OAuth authorization callback failure. */
export class OAuthCallbackError extends Error {
	readonly code: OAuthCallbackErrorCode
	readonly status = 400

	constructor(code: OAuthCallbackErrorCode) {
		super(code)
		this.name = 'OAuthCallbackError'
		this.code = code
	}
}

const OAUTH_CALLBACK_ERROR_MAX_LENGTH = 128
const OAUTH_CALLBACK_DESCRIPTION_MAX_LENGTH = 1024
const OAUTH_CANCELLATION_ERRORS = new Set(['access_denied', 'user_cancelled_authorize'])

/**
 * Create OAuth state and code verifier cookies
 * @param {Object} cookies - SvelteKit cookies object
 * @param {string} provider - Provider name (e.g., 'google', 'apple')
 * @param {Object} options - Cookie options
 * @param {boolean} [options.secure=true] - Use secure cookies
 * @param {number} [options.maxAge=1800] - Cookie max age in seconds (default 30 min)
 * @returns {{state: string, codeVerifier: string}}
 */
export function createOAuthCookies(
	cookies: CookiesLike,
	provider: string,
	options: OAuthCookieOptions
): { state: string; codeVerifier: string } {
	const {
		intent,
		userId,
		redirectTo = '',
		secure = true,
		maxAge = 30 * 60,
		sameSite = 'lax'
	} = options
	if (
		(intent === 'sign-in' && userId !== null) ||
		(intent !== 'sign-in' && (!userId || userId.length > 512)) ||
		redirectTo.length > 1024
	) {
		throw new Error('Invalid OAuth flow context')
	}

	const state = bytesToBase64Url(randomBytes(32))
	const codeVerifier = bytesToBase64Url(randomBytes(32))

	const cookieOptions = {
		httpOnly: true,
		path: '/',
		secure,
		sameSite,
		maxAge
	}

	// Store state cookie
	cookies.set(`${provider}_oauth_state`, state, cookieOptions)

	// Store code verifier cookie
	cookies.set(`${provider}_oauth_code_verifier`, codeVerifier, {
		...cookieOptions,
		secure
	})
	cookies.set(
		`${provider}_oauth_context`,
		JSON.stringify({ state, intent, userId, redirectTo }),
		cookieOptions
	)

	return { state, codeVerifier }
}

/**
 * Clean up OAuth cookies after authentication
 * @param {Object} cookies - SvelteKit cookies object
 * @param {string} provider - Provider name
 */
function cleanupOAuthCookies(cookies: CookiesLike, provider: string): void {
	cookies.delete(`${provider}_oauth_state`, { path: '/' })
	cookies.delete(`${provider}_oauth_code_verifier`, { path: '/' })
	cookies.delete(`${provider}_oauth_context`, { path: '/' })
}

function readOAuthFlowContext(
	cookies: CookiesLike,
	provider: string,
	state: string | null
): OAuthFlowContext {
	const raw = cookies.get(`${provider}_oauth_context`)
	if (!raw || raw.length > 2048) throw new OAuthCallbackError('invalid_callback')
	let value: unknown
	try {
		value = JSON.parse(raw)
	} catch {
		throw new OAuthCallbackError('invalid_callback')
	}
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new OAuthCallbackError('invalid_callback')
	}
	const context = value as Record<string, unknown>
	const intent = context['intent']
	const userId = context['userId']
	const redirectTo = context['redirectTo']
	const storedContextState = context['state']
	if (
		(intent !== 'sign-in' && intent !== 'link' && intent !== 'reauth') ||
		(userId !== null && typeof userId !== 'string') ||
		(intent === 'sign-in' && userId !== null) ||
		(intent !== 'sign-in' &&
			(typeof userId !== 'string' || userId.length === 0 || userId.length > 512)) ||
		typeof redirectTo !== 'string' ||
		redirectTo.length > 1024 ||
		typeof storedContextState !== 'string' ||
		!constantTimeEqual(storedContextState, state ?? '')
	) {
		throw new OAuthCallbackError('invalid_callback')
	}
	return { intent, userId, redirectTo }
}

/**
 * Validate OAuth callback parameters
 * @param {Object} params - Callback parameters
 * @param {string} params.code - Authorization code from provider
 * @param {string} params.state - State from callback
 * @param {string} params.storedState - State from cookies
 * @param {string} params.storedCodeVerifier - Code verifier from cookies
 * @returns {boolean}
 */
export function validateOAuthCallback(params: OAuthCallbackParams): boolean {
	const { code, error, state, storedState, storedCodeVerifier } = params

	const stateMatches = constantTimeEqual(state ?? '', storedState ?? '')
	const hasSingleOutcome = Boolean(code) !== Boolean(error)
	return !!(hasSingleOutcome && storedCodeVerifier && storedState && stateMatches)
}

function readCallbackValue(value: string | null, maxLength: number): string | null {
	if (value === null) return null
	if (value.length === 0 || value.length > maxLength) {
		throw new OAuthCallbackError('invalid_callback')
	}
	return value
}

/**
 * Extract OAuth callback parameters from request
 *
 * @param {Object} cookies - SvelteKit cookies object
 * @param {URL} url - Request URL
 * @param {string} provider - Provider name
 * @param overrides - overrides value.
 * @returns {{code: string | null, state: string | null, storedState: string | null, storedCodeVerifier: string | null}}
 */
export function getOAuthCallbackParams(
	cookies: CookiesLike,
	url: URL,
	provider: string,
	overrides: OAuthCallbackOverrides = {}
): OAuthCallbackParams {
	const code = 'code' in overrides ? (overrides.code ?? null) : url.searchParams.get('code')
	const state = 'state' in overrides ? (overrides.state ?? null) : url.searchParams.get('state')
	const callbackError =
		'error' in overrides ? (overrides.error ?? null) : url.searchParams.get('error')
	const errorDescription =
		'errorDescription' in overrides
			? (overrides.errorDescription ?? null)
			: url.searchParams.get('error_description')
	const storedState = cookies.get(`${provider}_oauth_state`) ?? null
	const storedCodeVerifier = cookies.get(`${provider}_oauth_code_verifier`) ?? null

	return {
		code: readCallbackValue(code, 4096),
		state: readCallbackValue(state, 512),
		error: readCallbackValue(callbackError, OAUTH_CALLBACK_ERROR_MAX_LENGTH),
		errorDescription: readCallbackValue(errorDescription, OAUTH_CALLBACK_DESCRIPTION_MAX_LENGTH),
		storedState,
		storedCodeVerifier
	}
}

/**
 * Create a generic OAuth callback handler
 * This handles the full OAuth flow including validation, profile fetching, and cleanup
 *
 * @param {import('@sveltejs/kit').RequestEvent} params.event - SvelteKit request event
 * @param {string} params.provider - Provider name
 * @param {import('../providers/OAuthProvider.ts').OAuthProvider} params.providerInstance - Provider instance
 * @param {Object} params.callbacks - Lifecycle callbacks
 * @param {string} [params.appleUserData] - Optional Apple user data from POST body
 * @param overrideParams - override params value.
 * @returns {Promise<{profile: Object, tokens: Object}>}
 */
export async function handleOAuthCallback({
	event,
	provider,
	providerInstance,
	callbacks,
	appleUserData = null,
	overrideParams = null
}: {
	event: RequestEvent | RequestEventLike | { cookies: CookiesLike; url: URL; request: Request }
	provider: string
	providerInstance: OAuthProvider
	callbacks: OAuthCallbackHandlers
	appleUserData?: string | null
	overrideParams?: OAuthCallbackOverrides | null
}): Promise<{ profile: OAuthProfile; tokens: OAuthTokens }> {
	const { cookies, url } = event
	const override: OAuthCallbackOverrides = overrideParams || {}

	try {
		// Extract and validate callback parameters
		const params = getOAuthCallbackParams(cookies, url, provider, override)

		if (!validateOAuthCallback(params)) {
			throw new OAuthCallbackError('invalid_callback')
		}
		const context = readOAuthFlowContext(cookies, provider, params.state)
		if (params.error) {
			throw new OAuthCallbackError(
				OAUTH_CANCELLATION_ERRORS.has(params.error) ? 'cancelled' : 'provider_rejected'
			)
		}
		if (!params.code || !params.storedCodeVerifier) {
			throw new OAuthCallbackError('invalid_callback')
		}

		// Fetch user profile from provider
		let profile: { profile: OAuthProfile; tokens: OAuthTokens } | null = null
		if (provider === 'apple' && appleUserData) {
			profile = await providerInstance.getUserProfile(
				params.code,
				params.storedCodeVerifier,
				appleUserData
			)
		} else {
			profile = await providerInstance.getUserProfile(params.code, params.storedCodeVerifier)
		}

		if (!profile?.profile) {
			throw new Error('Invalid provider profile')
		}

		// Cleanup OAuth cookies
		cleanupOAuthCookies(cookies, provider)

		// Call user-provided authentication handler
		if (callbacks.onAuthenticated) {
			await callbacks.onAuthenticated(profile.profile, profile.tokens, context)
		}

		return profile
	} catch (error) {
		if (callbacks.onError && !(error instanceof OAuthCallbackError && error.code === 'cancelled')) {
			await callbacks.onError(error)
		}

		// Cleanup OAuth cookies on error
		cleanupOAuthCookies(cookies, provider)
		throw error
	}
}
