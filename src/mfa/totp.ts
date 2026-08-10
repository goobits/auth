import { constantTimeEqual, randomBytes } from '@goobits/security/crypto'

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const MAX_VERIFICATION_WINDOW = 10

function assertTotpParameters(digits: number, period: number, time: number): void {
	if (!Number.isSafeInteger(digits) || digits < 1 || digits > 10) {
		throw new RangeError('TOTP digits must be an integer from 1 to 10')
	}
	if (!Number.isSafeInteger(period) || period <= 0) {
		throw new RangeError('TOTP period must be a positive integer')
	}
	if (!Number.isFinite(time)) {
		throw new RangeError('TOTP time must be finite')
	}
}

function toBase32(bytes: Uint8Array): string {
	let bits = 0
	let value = 0
	let output = ''
	for (const byte of bytes) {
		value = (value << 8) | byte
		bits += 8
		while (bits >= 5) {
			output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
			bits -= 5
		}
	}
	if (bits > 0) {
		output += BASE32_ALPHABET[(value << (5 - bits)) & 31]
	}
	return output
}

function fromBase32(input: string): Uint8Array {
	const clean = input.replace(/=+$/g, '').toUpperCase()
	let bits = 0
	let value = 0
	const output = []
	for (const ch of clean) {
		const idx = BASE32_ALPHABET.indexOf(ch)
		if (idx === -1) continue
		value = (value << 5) | idx
		bits += 5
		if (bits >= 8) {
			output.push((value >>> (bits - 8)) & 255)
			bits -= 8
		}
	}
	return new Uint8Array(output)
}

async function hmacSha1(keyBytes: Uint8Array, messageBytes: Uint8Array): Promise<Uint8Array> {
	if (!globalThis.crypto?.subtle) {
		throw new Error('WebCrypto is required')
	}
	const key = await crypto.subtle.importKey(
		'raw',
		keyBytes as unknown as BufferSource,
		{ name: 'HMAC', hash: 'SHA-1' },
		false,
		['sign']
	)
	const sig = await crypto.subtle.sign('HMAC', key, messageBytes as unknown as BufferSource)
	return new Uint8Array(sig)
}

function intToBytes(num: number): Uint8Array {
	const bytes = new Uint8Array(8)
	for (let i = 7; i >= 0; i -= 1) {
		bytes[i] = num & 0xff
		num = Math.floor(num / 256)
	}
	return bytes
}

/** Generates a base32 TOTP shared secret. */
export function generateSecret({ length = 20 }: { length?: number } = {}): string {
	return toBase32(randomBytes(length))
}

/** Builds an otpauth URL for authenticator apps. */
export function createOtpAuthURL({
	secret = '',
	label = '',
	issuer = '',
	digits = 6,
	period = 30
}: {
	secret?: string
	label?: string
	issuer?: string
	digits?: number
	period?: number
} = {}): string {
	const params = new URLSearchParams({
		secret,
		issuer,
		digits: String(digits),
		period: String(period)
	})
	return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`
}

/** Generates a TOTP token for a secret and time window. */
export async function generateTOTP({
	secret = '',
	time = Date.now(),
	digits = 6,
	period = 30
}: {
	secret?: string
	time?: number
	digits?: number
	period?: number
} = {}): Promise<string> {
	if (!secret) {
		throw new Error('TOTP secret is required')
	}
	assertTotpParameters(digits, period, time)
	const counter = Math.floor(time / 1000 / period)
	const counterBytes = intToBytes(counter)
	const keyBytes = fromBase32(secret)
	const hash = await hmacSha1(keyBytes, counterBytes)
	const last = hash[hash.length - 1] ?? 0
	const offset = last & 0xf
	const code =
		(((hash[offset] ?? 0) & 0x7f) << 24) |
		(((hash[offset + 1] ?? 0) & 0xff) << 16) |
		(((hash[offset + 2] ?? 0) & 0xff) << 8) |
		((hash[offset + 3] ?? 0) & 0xff)
	const otp = (code % 10 ** digits).toString().padStart(digits, '0')
	return otp
}

export type TotpMatch = {
	/** RFC 6238 moving-factor counter matched by the submitted token. */
	counter: number
}

/** Returns the moving-factor counter matched within a configurable time window. */
export async function matchTOTP({
	secret = '',
	token = '',
	digits = 6,
	period = 30,
	window = 1,
	time = Date.now()
}: {
	secret?: string
	token?: string
	digits?: number
	period?: number
	window?: number
	time?: number
} = {}): Promise<TotpMatch | null> {
	if (!secret || !token) return null
	if (!Number.isSafeInteger(window) || window < 0 || window > MAX_VERIFICATION_WINDOW) {
		throw new RangeError(`TOTP window must be an integer from 0 to ${MAX_VERIFICATION_WINDOW}`)
	}
	assertTotpParameters(digits, period, time)
	if (token.length !== digits || !/^\d+$/u.test(token)) return null
	let matchedCounter: number | null = null
	for (let errorWindow = -window; errorWindow <= window; errorWindow += 1) {
		const t = time + errorWindow * period * 1000
		const candidate = await generateTOTP({ secret, time: t, digits, period })
		if (constantTimeEqual(candidate, token)) {
			const counter = Math.floor(t / 1000 / period)
			if (matchedCounter === null || counter > matchedCounter) matchedCounter = counter
		}
	}
	return matchedCounter === null ? null : { counter: matchedCounter }
}

/** Verifies a TOTP token within a configurable time window. */
export async function verifyTOTP(input: Parameters<typeof matchTOTP>[0] = {}): Promise<boolean> {
	return (await matchTOTP(input)) !== null
}
