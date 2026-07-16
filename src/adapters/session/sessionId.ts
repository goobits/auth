import { bytesToBase64Url, randomBytes, sha256Hex } from '@goobits/security/crypto'

/** Generates an unpadded, cryptographically secure session identifier. */
export function generateSessionId(byteLength = 20): string {
	return bytesToBase64Url(randomBytes(byteLength))
}

/** Creates a high-entropy bearer token. Only the caller may receive this value. */
export function createSessionToken(): string {
	return generateSessionId(32)
}

/** Derives the verifier persisted by session stores. */
export function hashSessionToken(token: string): Promise<string> {
	return sha256Hex(token)
}
