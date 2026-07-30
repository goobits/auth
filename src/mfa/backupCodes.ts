import {
	bytesToHex,
	constantTimeEqual,
	hexToBytes,
	randomBytes,
	sha256Hex
} from '@goobits/security/crypto'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const PBKDF2_ITERATIONS = 100_000
const SALT_BYTES = 16
const HASH_VERSION = 'v2'
const LEGACY_SHA256_PATTERN = /^[0-9a-f]{64}$/u
const VERSIONED_HASH_PATTERN = /^v2:([0-9a-f]{32}):([0-9a-f]{64})$/u

function randomCode(length: number = 10): string {
	const bytes = randomBytes(length)
	let out = ''
	for (const b of bytes) {
		out += ALPHABET[b % ALPHABET.length]
	}
	return out
}

/** Generates one-time MFA backup codes. */
export function generateBackupCodes({
	count = 10,
	length = 10
}: { count?: number; length?: number } = {}): string[] {
	const codes: string[] = []
	for (let i = 0; i < count; i += 1) {
		codes.push(randomCode(length))
	}
	return codes
}

async function deriveCodeHash(code: string, saltHex: string): Promise<string> {
	const key = await globalThis.crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(code),
		'PBKDF2',
		false,
		['deriveBits']
	)
	const bits = await globalThis.crypto.subtle.deriveBits(
		{
			name: 'PBKDF2',
			hash: 'SHA-256',
			iterations: PBKDF2_ITERATIONS,
			salt: new Uint8Array(hexToBytes(saltHex))
		},
		key,
		256
	)
	return bytesToHex(new Uint8Array(bits))
}

/** Hashes MFA backup codes as versioned, independently salted PBKDF2 values. */
export async function hashBackupCodes(codes: string[]): Promise<string[]> {
	return Promise.all(
		codes.map(async (code) => {
			const saltHex = bytesToHex(randomBytes(SALT_BYTES))
			const hash = await deriveCodeHash(code, saltHex)
			return `${HASH_VERSION}:${saltHex}:${hash}`
		})
	)
}

/** Verifies a backup code against stored hashes. */
export async function verifyBackupCode({
	code,
	hashedCodes
}: {
	code?: string
	hashedCodes?: string[]
}): Promise<{ valid: boolean; hash?: string; index?: number }> {
	if (!code || !hashedCodes?.length) return { valid: false }
	const legacyCandidate = await sha256Hex(code)
	let match: { hash: string; index: number } | undefined

	for (let index = 0; index < hashedCodes.length; index += 1) {
		const stored = hashedCodes[index] ?? ''
		const versioned = VERSIONED_HASH_PATTERN.exec(stored)
		const matches = versioned
			? constantTimeEqual(await deriveCodeHash(code, versioned[1]!), versioned[2]!)
			: LEGACY_SHA256_PATTERN.test(stored) && constantTimeEqual(legacyCandidate, stored)
		if (matches && !match) match = { hash: stored, index }
	}

	return match ? { valid: true, ...match } : { valid: false }
}
