import { bytesToBase64Url, randomBytes } from '@goobits/security/crypto'

/** Generates an unpadded, cryptographically secure session identifier. */
export function generateSessionId(byteLength = 20): string {
	return bytesToBase64Url(randomBytes(byteLength))
}
