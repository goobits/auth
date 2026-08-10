import { APPLE_CLOCK_SKEW_SECONDS } from './_appleJwt.ts'

type AppleServerNotificationPayload = {
	iss?: string
	aud?: string | string[]
	iat?: number
	jti?: string
	events?: unknown
}

export type AppleServerNotificationType =
	| 'email-disabled'
	| 'email-enabled'
	| 'consent-revoked'
	| 'account-deleted'

/** Verified, normalized Sign in with Apple account-change event. */
export type AppleServerNotification = {
	jwtId: string
	type: AppleServerNotificationType
	subject: string
	eventTime: number
	email?: string
	isPrivateEmail?: boolean
}

const APPLE_EVENTS_MAX_BYTES = 8 * 1024
const APPLE_MILLISECONDS_THRESHOLD = 10_000_000_000
const APPLE_NOTIFICATION_TYPES = new Set<AppleServerNotificationType>([
	'email-disabled',
	'email-enabled',
	'consent-revoked',
	'account-deleted'
])

export function normalizeAppleServerNotification(
	payload: AppleServerNotificationPayload
): AppleServerNotification {
	const events = parseAppleEvents(payload.events)
	const type = events?.['type']
	const subject = events?.['sub']
	const eventTime = normalizeAppleEventTime(events?.['event_time'])
	const email = events?.['email']
	const privateEmail = events?.['is_private_email']
	const now = Math.floor(Date.now() / 1000)
	if (
		typeof payload.iat !== 'number' ||
		!Number.isSafeInteger(payload.iat) ||
		payload.iat <= 0 ||
		payload.iat > now + APPLE_CLOCK_SKEW_SECONDS ||
		typeof payload.jti !== 'string' ||
		payload.jti.length === 0 ||
		payload.jti.length > 512 ||
		typeof type !== 'string' ||
		!APPLE_NOTIFICATION_TYPES.has(type as AppleServerNotificationType) ||
		typeof subject !== 'string' ||
		subject.length === 0 ||
		subject.length > 255 ||
		eventTime === null ||
		eventTime > now + APPLE_CLOCK_SKEW_SECONDS ||
		(email !== undefined &&
			(typeof email !== 'string' || email.length === 0 || email.length > 320)) ||
		((type === 'email-enabled' || type === 'email-disabled') && typeof email !== 'string')
	) {
		throw new Error('Invalid Apple server notification')
	}

	const normalized: AppleServerNotification = {
		jwtId: payload.jti,
		type: type as AppleServerNotificationType,
		subject,
		eventTime
	}
	if (typeof email === 'string') normalized.email = email
	const isPrivateEmail = parseAppleBoolean(privateEmail)
	if (privateEmail !== undefined && isPrivateEmail === undefined) {
		throw new Error('Invalid Apple server notification')
	}
	if (isPrivateEmail !== undefined) normalized.isPrivateEmail = isPrivateEmail
	return normalized
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseAppleBoolean(value: unknown): boolean | undefined {
	if (value === true || value === 'true') return true
	if (value === false || value === 'false') return false
	return undefined
}

function parseAppleEvents(value: unknown): Record<string, unknown> | null {
	if (isRecord(value)) return value
	if (typeof value !== 'string' || value.length === 0 || value.length > APPLE_EVENTS_MAX_BYTES) {
		return null
	}
	try {
		const parsed: unknown = JSON.parse(value)
		return isRecord(parsed) ? parsed : null
	} catch {
		return null
	}
}

/** Normalizes Apple's documented seconds and legacy millisecond event timestamps. */
function normalizeAppleEventTime(value: unknown): number | null {
	if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) return null
	return value >= APPLE_MILLISECONDS_THRESHOLD ? Math.floor(value / 1000) : value
}
