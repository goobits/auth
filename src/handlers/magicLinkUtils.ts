import { bytesToBase64Url, randomBytes } from '@goobits/security/crypto'

import { sha256Hex } from '../utils/crypto.ts'

export async function generateMagicLinkToken(bytesLength: number = 32): Promise<string> {
	return bytesToBase64Url(randomBytes(bytesLength))
}

export async function generateOtp(digits: number = 6): Promise<string> {
	const max = 10 ** digits
	const bytes = randomBytes(4)
	const b0 = bytes[0] ?? 0
	const b1 = bytes[1] ?? 0
	const b2 = bytes[2] ?? 0
	const b3 = bytes[3] ?? 0
	const value = ((b0 << 24) | (b1 << 16) | (b2 << 8) | b3) >>> 0
	const code = value % max
	return String(code).padStart(digits, '0')
}

export async function hashToken(token: string): Promise<string> {
	return sha256Hex(token)
}
