import { bytesToBase64Url, randomBytes, signHmac } from '@goobits/security/crypto'

import { sha256Hex } from '../utils/crypto.ts'

export async function generateMagicLinkToken(bytesLength: number = 32): Promise<string> {
	return bytesToBase64Url(randomBytes(bytesLength))
}

export async function generateOtp(digits: number = 6): Promise<string> {
	const max = 10 ** digits
	const limit = Math.floor(0x1_0000_0000 / max) * max
	for (;;) {
		const bytes = randomBytes(4)
		const value =
			(((bytes[0] ?? 0) << 24) |
				((bytes[1] ?? 0) << 16) |
				((bytes[2] ?? 0) << 8) |
				(bytes[3] ?? 0)) >>>
			0
		if (value < limit) return String(value % max).padStart(digits, '0')
	}
}

export async function hashToken(token: string): Promise<string> {
	return sha256Hex(token)
}

/** HMACs a low-entropy OTP and binds it to its normalized email owner. */
export async function hashMagicLinkOtp(
	email: string,
	otp: string,
	pepper: string | Uint8Array
): Promise<string> {
	assertMagicLinkOtpPepper(pepper)
	return (await signHmac(`${email}\0${otp}`, pepper, 'HS256')).value
}

/** Rejects weak OTP peppers before a handler begins accepting traffic. */
export function assertMagicLinkOtpPepper(pepper: string | Uint8Array): void {
	const length =
		typeof pepper === 'string' ? new TextEncoder().encode(pepper).length : pepper.length
	if (length < 32) throw new TypeError('Magic-link OTP pepper must contain at least 32 bytes')
}
