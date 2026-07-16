import type { SessionMetadata } from '../../types/core.ts'
import { parseMfaVerifiedAt, parseSessionTimestamp } from './sessionAssurance.ts'

const ALLOWED_KEYS = new Set<keyof SessionMetadata>([
	'createdAt',
	'fingerprint',
	'ip',
	'mfaVerifiedAt',
	'rememberMe',
	'userAgent'
])

const STRING_LIMITS = {
	fingerprint: 256,
	ip: 64,
	userAgent: 512
} as const

/** Runtime-normalizes the deliberately small metadata contract accepted by session stores. */
export function normalizeSessionMetadata(metadata: SessionMetadata = {}): SessionMetadata {
	for (const key of Object.keys(metadata)) {
		if (!ALLOWED_KEYS.has(key as keyof SessionMetadata)) {
			throw new TypeError(`Unsupported session metadata field: ${key}`)
		}
	}

	const normalized: SessionMetadata = {}
	const createdAt = normalizeDate(metadata.createdAt, 'createdAt', parseSessionTimestamp)
	const mfaVerifiedAt = normalizeDate(metadata.mfaVerifiedAt, 'mfaVerifiedAt', parseMfaVerifiedAt)
	if (createdAt) normalized.createdAt = createdAt
	if (mfaVerifiedAt) normalized.mfaVerifiedAt = mfaVerifiedAt
	if (metadata.rememberMe !== undefined) {
		if (typeof metadata.rememberMe !== 'boolean') {
			throw new TypeError('Session metadata rememberMe must be a boolean')
		}
		normalized.rememberMe = metadata.rememberMe
	}
	for (const key of ['fingerprint', 'ip', 'userAgent'] as const) {
		const value = metadata[key]
		if (value === undefined) continue
		if (typeof value !== 'string' || value.length === 0 || value.length > STRING_LIMITS[key]) {
			throw new TypeError(
				`Session metadata ${key} must be a non-empty string of at most ${STRING_LIMITS[key]} characters`
			)
		}
		normalized[key] = value
	}
	return normalized
}

function normalizeDate(
	value: unknown,
	name: string,
	parse: (candidate: unknown) => Date | null
): Date | undefined {
	if (value === undefined) return undefined
	const parsed = parse(value)
	if (!parsed) throw new TypeError(`Session metadata ${name} must be a valid date`)
	return parsed
}
