import { AUTH_ROUTE_PATHS, resolveAuthRoutePath } from '../_routePaths.ts'
import type { Logger } from '../_internal/logger.ts'
import type { AuthRequestHandler, RequestEventLike } from '../types/auth.ts'
import type { User } from '../types/index.ts'
import { jsonResponse, parseRequestData } from '../utils/http.ts'
import { isSafeRedirectPath } from '../utils/redirect.ts'
import type { AuthEventEmitter } from '../security/events.ts'
import type { MagicLinkTokenAdapter, MagicLinkUserAdapter } from './_magicLinkTypes.ts'
import {
	assertMagicLinkOtpPepper,
	generateMagicLinkToken,
	generateOtp,
	hashMagicLinkOtp,
	hashToken
} from './magicLinkUtils.ts'

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
	baseUrl: string
	otpPepper?: string | Uint8Array
	rateLimit?: (event: RequestEventLike) => Promise<void> | void
	getMetadata?: (event: RequestEventLike) => Promise<Record<string, unknown>>
	key?: (event: RequestEventLike) => string
	logger?: Logger
	emitSecurityEvent?: AuthEventEmitter
}

function validateMagicLinkBaseUrl(value: string): string {
	let parsed: URL
	try {
		parsed = new URL(value)
	} catch {
		throw new TypeError('Magic-link baseUrl must be an absolute HTTPS URL')
	}
	if (
		parsed.protocol !== 'https:' ||
		parsed.username ||
		parsed.password ||
		parsed.pathname !== '/' ||
		parsed.search ||
		parsed.hash
	) {
		throw new TypeError('Magic-link baseUrl must be a credential-free HTTPS origin')
	}
	return parsed.origin
}

/** Creates magic link request handler for auth HTTP handlers. */
export function createMagicLinkRequestHandler(config: MagicLinkRequestConfig): AuthRequestHandler {
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
		baseUrl,
		otpPepper,
		rateLimit,
		getMetadata
	} = config

	if (!magicLinkAdapter) throw new Error('createMagicLinkRequestHandler requires magicLinkAdapter')
	if (typeof sendEmail !== 'function') {
		throw new Error('createMagicLinkRequestHandler requires sendEmail')
	}
	const publicBaseUrl = validateMagicLinkBaseUrl(baseUrl)
	if (includeOtp && !otpPepper) {
		throw new Error('createMagicLinkRequestHandler requires otpPepper when OTP is enabled')
	}
	if (otpPepper) assertMagicLinkOtpPepper(otpPepper)
	if (!Number.isSafeInteger(otpDigits) || otpDigits < 6 || otpDigits > 9) {
		throw new TypeError('Magic-link otpDigits must be an integer between 6 and 9')
	}
	if (!Number.isSafeInteger(expiresInMs) || expiresInMs <= 0 || expiresInMs > 24 * 60 * 60 * 1000) {
		throw new TypeError('Magic-link expiresInMs must be between 1 ms and 24 hours')
	}

	return async (event: RequestEventLike) => {
		if (rateLimit) await rateLimit(event)

		const data = await parseRequestData(event.request)
		const emailInput =
			(typeof data['email'] === 'string' && data['email']) ||
			(typeof data['identifier'] === 'string' && data['identifier']) ||
			''
		const email = normalizeEmail(String(emailInput || ''))
		if (!email) return jsonResponse({ ok: false, error: 'Email required' }, 400)

		const user = userAdapter ? await userAdapter.getUserByEmail(email) : null
		if (!user && !allowSignup) return jsonResponse({ ok: true }, 200)
		if (singleUsePerEmail) await magicLinkAdapter.deleteByEmail(email)

		const token = await generateMagicLinkToken()
		const tokenHash = await hashToken(token)
		const otp = includeOtp ? await generateOtp(otpDigits) : null
		const otpHash = otp ? await hashMagicLinkOtp(email, otp, otpPepper!) : null
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
		const url = new URL(magicLinkPath, publicBaseUrl)
		url.searchParams.set('token', token)
		if (redirectTo) url.searchParams.set('redirectTo', redirectTo)

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
		return jsonResponse({ ok: true })
	}
}
