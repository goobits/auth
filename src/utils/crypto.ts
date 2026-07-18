import {
	bytesToHex,
	hexToBytes,
	openJson,
	randomBytes,
	sealJson,
	sha256Hex as securitySha256Hex
} from '@goobits/security/crypto'

function validateEncryptionKey(encryptionKey: string): Uint8Array {
	const keyBytes = hexToBytes(encryptionKey)
	if (keyBytes.length !== 32) {
		throw new Error('Encryption key must be 32 bytes (64 hex chars)')
	}
	return keyBytes
}

/** Encrypts OAuth token payloads using an application encryption key. */
export async function encryptTokens<T extends Record<string, unknown>>(
	tokens: T,
	encryptionKey: string
): Promise<string> {
	if (!encryptionKey) {
		throw new Error('Encryption key is required')
	}

	validateEncryptionKey(encryptionKey)
	return JSON.stringify(await sealJson(tokens, { key: encryptionKey }))
}

/** Decrypts OAuth token payloads using an application encryption key. */
export async function decryptTokens<T = Record<string, unknown>>(
	encryptedData: string | null,
	encryptionKey: string
): Promise<T | null> {
	if (!encryptedData) return null
	if (!encryptionKey) {
		throw new Error('Encryption key is required')
	}

	try {
		validateEncryptionKey(encryptionKey)
		return openJson<T>({ key: encryptionKey, seal: JSON.parse(encryptedData) })
	} catch {
		return null
	}
}

/** Generates a random UUID with WebCrypto fallback support. */
export async function generateRandomUUID(): Promise<string> {
	if (globalThis.crypto?.randomUUID) {
		return globalThis.crypto.randomUUID()
	}
	const bytes = randomBytes(16)
	bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40
	bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80
	const hex = bytesToHex(bytes)
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** Hashes a value with SHA-256 and returns hex. */
export async function sha256Hex(value: string | Uint8Array): Promise<string> {
	return securitySha256Hex(value)
}
