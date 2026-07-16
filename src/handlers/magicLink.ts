import { redirect, type RequestHandler } from '@sveltejs/kit'
import { constantTimeEqual } from '@goobits/security/crypto'
import { createRateLimiter } from '@goobits/security/rate-limit'

import { AUTH_ROUTE_PATHS, resolveAuthRoutePath } from '../_routePaths.ts'
import type { UserAdapter } from '../adapters/database/UserAdapter.ts'
import type { MagicLinkAdapter } from '../adapters/magic-link/MagicLinkAdapter.ts'
import type { SessionAdapter } from '../adapters/session/SessionAdapter.ts'
import { AuthPrincipalResolutionError } from '../errors/AuthPrincipalResolutionError.ts'
import type { Logger } from '../_internal/logger.ts'
import { auditAuthEvent } from '../security/audit.ts'
import { CSRF_COOKIE_NAME } from '../security/csrf.ts'
import type { AuthHooks, AuthLocals, OnLoginMode, RequestEventLike } from '../types/auth.ts'
import type { User } from '../types/index.ts'
import { jsonResponse, parseRequestData } from '../utils/http.ts'
import { isSafeRedirectPath } from '../utils/redirect.ts'
import { sanitizeUser as defaultSanitizeUser } from '../utils/sanitize.ts'
import { generateMagicLinkToken, generateOtp, hashToken } from './magicLinkUtils.ts'
import { resolveHandlerRateLimitKey } from './rateLimitKey.ts'
import { ensureSessionAfterLogin } from './sessionLifecycle.ts'

type MagicLinkTokenAdapter = Pick<
	MagicLinkAdapter,
	| 'createToken'
	| 'findByTokenHash'
	| 'findByEmailAndOtpHash'
	| 'consumeByTokenHash'
	| 'consumeByEmailAndOtpHash'
	| 'deleteById'
	| 'deleteByEmail'
>

type MagicLinkUserAdapter = Pick<
	UserAdapter,
	'getUserByEmail' | 'getUserById' | 'createUser' | 'updateUser'
>

type MagicLinkSessionAdapterLike = Pick<SessionAdapter, 'createSession'> &
	Partial<Pick<SessionAdapter, 'setSessionCookie'>>

type MagicLinkRequestConfig = {
	magicLinkAdapter: MagicLinkTokenAdapter
	userAdapter?: Pick<MagicLinkUserAdapter, 'getUserByEmail'>
	sendEmail: (payload: {
		email: string
		link: string
		otp: string | null
		token: string
		expiresAt: Date
		user: User | null
		redirectTo: string
		secureCookies: boolean
	}) => Promise<void> | void
	allowSignup?: boolean
	expiresInMs?: number
	magicLinkPath?: string
	includeOtp?: boolean
	otpDigits?: number
	singleUsePerEmail?: boolean
	secureCookies?: boolean
	normalizeEmail?: (email: string) => string
	exposeToken?: boolean
	baseUrl?: string
	rateLimit?: (event: RequestEventLike) => Promise<void> | void
	getMetadata?: (event: RequestEventLike) => Promise<Record<string, unknown>>
	key?: (event: RequestEventLike) => string
	logger?: Logger
}

type MagicLinkVerifyConfig = {
	magicLinkAdapter: MagicLinkTokenAdapter
	userAdapter?: MagicLinkUserAdapter
	sessionAdapter: MagicLinkSessionAdapterLike
	allowSignup?: boolean
	createUser?: (email: string, event: RequestEventLike) => Promise<User>
	onLogin?: AuthHooks['onLogin']
	redirectAfterLogin?: string
	isAuthenticated?: (locals: AuthLocals) => boolean
	secureCookies?: boolean
	normalizeEmail?: (email: string) => string
	verifyRateLimit?: (key: string) => Promise<{ allowed: boolean }>
	verifyRateLimitMax?: number
	verifyRateLimitWindowMs?: number
	sanitizeUser?: (user: User | null) => User | null
	autoCreateSession?: boolean
	onLoginMode?: OnLoginMode
	key?: (event: RequestEventLike) => string
	requireUserConfirmation?: boolean
	confirmationCookieName?: string
	confirmationTtlSeconds?: number
	csrfCookieName?: string
	logger?: Logger
}

type MagicLinkTokenRecord = {
	id?: string
	userId?: string
	email?: string
	expiresAt?: string | Date
	[key: string]: unknown
}

function isProductionRuntime(): boolean {
	return typeof process !== 'undefined' && process.env['NODE_ENV'] === 'production'
}

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;')
}

function magicLinkConfirmationResponse({
	token,
	redirectTo,
	confirmation,
	csrfToken
}: {
	token: string
	redirectTo: string
	confirmation: string
	csrfToken: string
}): Response {
	const redirectField = redirectTo
		? `<input type="hidden" name="redirectTo" value="${escapeHtml(redirectTo)}">`
		: ''
	const body = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>Confirm sign in</title></head>
<body><main><h1>Confirm sign in</h1><p>Continue only if you requested this sign-in link.</p><form method="post"><input type="hidden" name="token" value="${escapeHtml(token)}"><input type="hidden" name="confirmation" value="${escapeHtml(confirmation)}"><input type="hidden" name="_csrf" value="${escapeHtml(csrfToken)}">${redirectField}<button type="submit">Continue</button></form></main></body></html>`
	return new Response(body, {
		status: 200,
		headers: {
			'cache-control': 'no-store, private',
			'content-type': 'text/html; charset=utf-8',
			'content-security-policy':
				"default-src 'none'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
			'referrer-policy': 'no-referrer',
			'x-content-type-options': 'nosniff'
		}
	})
}

/** Creates magic link request handler for auth HTTP handlers. */
export function createMagicLinkRequestHandler(config: MagicLinkRequestConfig): RequestHandler {
	const {
		magicLinkAdapter,
		userAdapter,
		sendEmail,
		allowSignup = false,
		expiresInMs = 15 * 60 * 1000,
		magicLinkPath = resolveAuthRoutePath('/auth', AUTH_ROUTE_PATHS.magicLinkVerify),
		includeOtp = true,
		otpDigits = 6,
		singleUsePerEmail = true,
		secureCookies = true,
		normalizeEmail = (email: string) => email.trim().toLowerCase(),
		exposeToken = false,
		baseUrl,
		rateLimit,
		getMetadata
	} = config

	if (!magicLinkAdapter) {
		throw new Error('createMagicLinkRequestHandler requires magicLinkAdapter')
	}
	if (typeof sendEmail !== 'function') {
		throw new Error('createMagicLinkRequestHandler requires sendEmail')
	}
	if (exposeToken && isProductionRuntime()) {
		throw new Error('Magic-link token exposure is forbidden in production')
	}

	return async (event: RequestEventLike) => {
		if (rateLimit) {
			await rateLimit(event)
		}

		const data = await parseRequestData(event.request)
		const emailInput =
			(typeof data['email'] === 'string' && data['email']) ||
			(typeof data['identifier'] === 'string' && data['identifier']) ||
			''
		const email = normalizeEmail(String(emailInput || ''))

		if (!email) {
			return jsonResponse({ ok: false, error: 'Email required' }, 400)
		}

		const user = userAdapter ? await userAdapter.getUserByEmail(email) : null

		if (!user && !allowSignup) {
			return jsonResponse({ ok: true }, 200)
		}

		if (singleUsePerEmail) {
			await magicLinkAdapter.deleteByEmail(email)
		}

		const token = await generateMagicLinkToken()
		const tokenHash = await hashToken(token)
		const otp = includeOtp ? await generateOtp(otpDigits) : null
		const otpHash = otp ? await hashToken(otp) : null
		const expiresAt = new Date(Date.now() + expiresInMs)
		const metadata = typeof getMetadata === 'function' ? await getMetadata(event) : {}

		const createdToken = await magicLinkAdapter.createToken({
			userId: user?.id ?? null,
			email,
			tokenHash,
			otpHash,
			expiresAt,
			metadata
		})

		const redirectToRaw = typeof data['redirectTo'] === 'string' ? data['redirectTo'] : ''
		const redirectTo = isSafeRedirectPath(redirectToRaw) ? redirectToRaw : ''
		const origin = baseUrl || event.url.origin
		const url = new URL(magicLinkPath, origin)
		url.searchParams.set('token', token)
		if (redirectTo) {
			url.searchParams.set('redirectTo', redirectTo)
		}

		try {
			await sendEmail({
				email,
				link: url.toString(),
				otp,
				token,
				expiresAt,
				user,
				redirectTo,
				secureCookies
			})
		} catch (error) {
			const createdTokenId =
				createdToken && typeof createdToken['id'] === 'string' ? createdToken['id'] : null
			if (createdTokenId) await magicLinkAdapter.deleteById(createdTokenId)
			throw error
		}

		if (exposeToken) {
			return jsonResponse({ ok: true, token, otp })
		}

		return jsonResponse({ ok: true })
	}
}

/** Creates magic link verify handler for auth HTTP handlers. */
export function createMagicLinkVerifyHandler(config: MagicLinkVerifyConfig) {
	const {
		magicLinkAdapter,
		userAdapter,
		sessionAdapter,
		allowSignup = false,
		createUser,
		onLogin,
		redirectAfterLogin = '/',
		isAuthenticated = (locals: AuthLocals) => !!locals.user,
		normalizeEmail = (email: string) => email.trim().toLowerCase(),
		verifyRateLimit,
		verifyRateLimitMax = 5,
		verifyRateLimitWindowMs = 10 * 60 * 1000,
		sanitizeUser = defaultSanitizeUser,
		autoCreateSession = true,
		onLoginMode = 'augment',
		requireUserConfirmation = true,
		confirmationCookieName = 'goobits_magic_confirmation',
		confirmationTtlSeconds = 10 * 60,
		csrfCookieName = CSRF_COOKIE_NAME
	} = config

	if (!magicLinkAdapter) {
		throw new Error('createMagicLinkVerifyHandler requires magicLinkAdapter')
	}
	if (!sessionAdapter) {
		throw new Error('createMagicLinkVerifyHandler requires sessionAdapter')
	}

	const checkMagicLinkRateLimit =
		typeof verifyRateLimit === 'function'
			? verifyRateLimit
			: createRateLimiter({
					windows: [
						{
							name: 'magic.verify',
							windowMs: verifyRateLimitWindowMs,
							maxEvents: verifyRateLimitMax
						}
					],
					keyPrefix: 'mlv'
				}).check

	return async (event: RequestEventLike) => {
		if (isAuthenticated(event.locals)) {
			throw redirect(302, isSafeRedirectPath(redirectAfterLogin) ? redirectAfterLogin : '/')
		}

		const data = await parseRequestData(event.request)
		const token =
			(typeof data['token'] === 'string' && data['token']) || event.url.searchParams.get('token')
		const redirectToRaw =
			(typeof data['redirectTo'] === 'string' && data['redirectTo']) ||
			event.url.searchParams.get('redirectTo') ||
			''
		const redirectTo = isSafeRedirectPath(redirectToRaw) ? redirectToRaw : ''
		const otp =
			(typeof data['otp'] === 'string' && data['otp']) ||
			(typeof data['code'] === 'string' && data['code'])
		const emailInput =
			(typeof data['email'] === 'string' && data['email']) ||
			event.url.searchParams.get('email') ||
			''
		const email = normalizeEmail(String(emailInput || ''))

		if (
			(!token && !(otp && email)) ||
			(token && token.length > 1024) ||
			(otp && otp.length > 32) ||
			email.length > 320
		) {
			return jsonResponse({ ok: false, error: 'Invalid magic link' }, 400)
		}

		const ipKey = resolveHandlerRateLimitKey(event, config)
		const identifier = email || (token ? await hashToken(token) : 'unknown')
		const rateKey = `${identifier}:${ipKey}`
		const rateResult = await checkMagicLinkRateLimit(rateKey)
		if (!rateResult?.allowed) {
			return jsonResponse({ ok: false, error: 'Too many attempts. Try again later.' }, 429)
		}

		if (token && requireUserConfirmation && event.request.method === 'GET') {
			const confirmation = await generateMagicLinkToken()
			event.cookies.set(confirmationCookieName, confirmation, {
				httpOnly: true,
				secure: config.secureCookies ?? true,
				sameSite: 'lax',
				path: '/',
				maxAge: confirmationTtlSeconds
			})
			return magicLinkConfirmationResponse({
				token,
				redirectTo,
				confirmation,
				csrfToken: event.cookies.get(csrfCookieName) ?? ''
			})
		}

		if (token && requireUserConfirmation) {
			const submittedConfirmation =
				typeof data['confirmation'] === 'string' ? data['confirmation'] : ''
			const storedConfirmation = event.cookies.get(confirmationCookieName) ?? ''
			event.cookies.delete(confirmationCookieName, { path: '/' })
			if (
				!submittedConfirmation ||
				!storedConfirmation ||
				!constantTimeEqual(submittedConfirmation, storedConfirmation)
			) {
				return jsonResponse({ ok: false, error: 'Invalid magic link confirmation' }, 400)
			}
		}

		// Atomic find-and-delete: in-tree adapters (Drizzle/D1) override
		// `consume*` with a single `DELETE ... RETURNING` to close the race
		// where two concurrent verifies of the same token would both succeed.
		let record: MagicLinkTokenRecord | null = null

		if (token) {
			const tokenHash = await hashToken(token)
			record = (await magicLinkAdapter.consumeByTokenHash(tokenHash)) as MagicLinkTokenRecord | null
		} else if (otp && email) {
			const otpHash = await hashToken(otp)
			record = (await magicLinkAdapter.consumeByEmailAndOtpHash({
				email,
				otpHash
			})) as MagicLinkTokenRecord | null
		}

		if (!record) {
			auditAuthEvent('magic_link.invalid', {
				email,
				hasToken: Boolean(token),
				hasOtp: Boolean(otp)
			})
			return jsonResponse({ ok: false, error: 'Invalid magic link' }, 400)
		}

		const expiresAt = record['expiresAt']
		if (expiresAt && new Date(expiresAt) < new Date()) {
			// Token was already consumed by the read above; just audit.
			auditAuthEvent('magic_link.expired', {
				email: record['email'] ?? email
			})
			return jsonResponse({ ok: false, error: 'Magic link expired' }, 400)
		}

		let user: User | null = null
		const recordUserId = typeof record['userId'] === 'string' ? record['userId'] : null
		const recordEmail = typeof record['email'] === 'string' ? record['email'] : null
		if (userAdapter) {
			if (recordUserId) {
				user = await userAdapter.getUserById(recordUserId)
			}
			if (!user && (recordEmail || email)) {
				user = await userAdapter.getUserByEmail(recordEmail || email)
			}
		}

		if (!user && allowSignup && userAdapter) {
			if (typeof createUser === 'function') {
				user = await createUser(recordEmail || email, event)
			} else {
				const signupEmail = recordEmail || email
				const signupName = signupEmail.split('@')[0] ?? ''
				user = await userAdapter.createUser({
					id: signupEmail,
					email: signupEmail,
					name: signupName,
					verified_email: true
				})
			}
		}

		if (user && userAdapter && user.emailVerified === false) {
			await userAdapter.updateUser(user.id, { emailVerified: true })
		}

		let userId = user?.id ? String(user.id) : recordUserId

		if (onLogin) {
			const profileEmail = recordEmail || email
			const profileName = user?.name || (profileEmail.split('@')[0] ?? '')
			const profile = {
				id: userId || profileEmail,
				email: profileEmail,
				name: profileName
			}
			const hookResult = await onLogin(event, profile, null, user)
			if (hookResult?.userId) userId = String(hookResult.userId)
		}
		try {
			userId = await ensureSessionAfterLogin({
				event,
				sessionAdapter,
				userId,
				autoCreateSession,
				onLoginMode
			})
		} catch (error) {
			if (error instanceof AuthPrincipalResolutionError) {
				return jsonResponse({ ok: false, error: error.message }, error.status)
			}
			throw error
		}

		if (event.request.method === 'GET') {
			throw redirect(302, redirectTo || redirectAfterLogin)
		}

		return jsonResponse({ ok: true, user: sanitizeUser(user) })
	}
}
