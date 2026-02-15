import { checkRateLimit, compactRateLimitBuckets, keyForRateLimit } from './rate-limit'
import { isDisposableEmailDomain, type DisposableMode } from './disposable-email'
import { verifyTurnstileToken } from './turnstile'

export type RegisterAntiAbuseInput = {
	email: string
	ip: string
	asn: string
	deviceId: string
	honeypot: string
	startedAtMs: number
	turnstileToken: string
	nowMs?: number
	env: Record<string, string | undefined>
}

export type RegisterAntiAbuseResult = {
	ok: boolean
	reason: 'allow' | 'blocked' | 'challenge_required'
	message?: string
	requiresChallenge: boolean
}

function toInt(value: string | undefined, fallback: number) {
	if (!value) return fallback
	const parsed = Number.parseInt(value, 10)
	if (!Number.isFinite(parsed) || parsed <= 0) return fallback
	return parsed
}

function enabled(value: string | undefined, fallback = false) {
	if (!value) return fallback
	return value === '1' || value.toLowerCase() === 'true'
}

function evaluateDisposablePolicy(modeRaw: string | undefined): DisposableMode {
	if (modeRaw === 'block' || modeRaw === 'score' || modeRaw === 'off') return modeRaw
	return 'score'
}

function genericFailure(): RegisterAntiAbuseResult {
	return {
		ok: false,
		reason: 'blocked',
		message: 'We could not complete that request. Please try again later.',
		requiresChallenge: true
	}
}

export async function runRegisterAntiAbuse(input: RegisterAntiAbuseInput): Promise<RegisterAntiAbuseResult> {
	const now = input.nowMs ?? Date.now()
	const antiAbuseEnabled = enabled(input.env['ANTIABUSE_ENABLED'], true)
	if (!antiAbuseEnabled) return { ok: true, reason: 'allow', requiresChallenge: false }

	compactRateLimitBuckets()

	if (input.honeypot.trim().length > 0) {
		return genericFailure()
	}

	const minSubmitMs = toInt(input.env['ABUSE_MIN_SUBMIT_MS'], 2500)
	if (!Number.isFinite(input.startedAtMs) || input.startedAtMs <= 0 || now - input.startedAtMs < minSubmitMs) {
		return genericFailure()
	}

	let riskScore = 0
	const ratePerIp = toInt(input.env['REGISTRATION_RATE_LIMIT_PER_IP'], 12)
	const ratePerEmail = toInt(input.env['REGISTRATION_RATE_LIMIT_PER_EMAIL'], 5)
	const ratePerDevice = toInt(input.env['REGISTRATION_RATE_LIMIT_PER_DEVICE'], 8)
	const ratePerAsn = toInt(input.env['REGISTRATION_RATE_LIMIT_PER_ASN'], 30)
	const rateWindowMs = toInt(input.env['REGISTRATION_RATE_LIMIT_WINDOW_MS'], 60 * 60 * 1000)

	const ipCheck = checkRateLimit(keyForRateLimit('signup:ip', input.ip || 'unknown'), ratePerIp, rateWindowMs)
	if (!ipCheck.allowed) return genericFailure()
	if (ipCheck.count > Math.ceil(ratePerIp * 0.7)) riskScore += 1

	const emailCheck = checkRateLimit(
		keyForRateLimit('signup:email', input.email || 'unknown@example.com'),
		ratePerEmail,
		rateWindowMs
	)
	if (!emailCheck.allowed) return genericFailure()
	if (emailCheck.count > Math.ceil(ratePerEmail * 0.6)) riskScore += 1

	if (input.deviceId) {
		const deviceCheck = checkRateLimit(
			keyForRateLimit('signup:device', input.deviceId),
			ratePerDevice,
			rateWindowMs
		)
		if (!deviceCheck.allowed) return genericFailure()
		if (deviceCheck.count > Math.ceil(ratePerDevice * 0.7)) riskScore += 1
	}

	if (input.asn) {
		const asnCheck = checkRateLimit(keyForRateLimit('signup:asn', input.asn), ratePerAsn, rateWindowMs)
		if (!asnCheck.allowed) return genericFailure()
		if (asnCheck.count > Math.ceil(ratePerAsn * 0.75)) riskScore += 1
	}

	const disposableMode = evaluateDisposablePolicy(input.env['DISPOSABLE_EMAIL_BLOCK_MODE'])
	if (isDisposableEmailDomain(input.email)) {
		if (disposableMode === 'block') return genericFailure()
		if (disposableMode === 'score') riskScore += 2
	}

	const alwaysRequireTurnstile = enabled(input.env['TURNSTILE_REQUIRED'], false)
	const shouldRequireChallenge = alwaysRequireTurnstile || riskScore >= 2
	if (!shouldRequireChallenge) {
		return { ok: true, reason: 'allow', requiresChallenge: false }
	}

	const secret = input.env['TURNSTILE_SECRET_KEY'] || ''
	if (!secret) {
		// If challenge is required but secret is absent, fail open only in dev-like mode.
		if (enabled(input.env['TURNSTILE_FAIL_OPEN'], true)) {
			return { ok: true, reason: 'allow', requiresChallenge: false }
		}
		return {
			ok: false,
			reason: 'challenge_required',
			message: 'Please retry and complete the security check.',
			requiresChallenge: true
		}
	}

	const verification = await verifyTurnstileToken({
		secret,
		token: input.turnstileToken,
		remoteIp: input.ip
	})

	if (!verification.success) {
		return {
			ok: false,
			reason: 'challenge_required',
			message: 'Please retry and complete the security check.',
			requiresChallenge: true
		}
	}

	return { ok: true, reason: 'allow', requiresChallenge: true }
}
