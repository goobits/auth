import { constantTimeEqual, randomBytes, sha256Hex } from '@goobits/security/crypto'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

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

/** Hashes MFA backup codes for storage. */
export async function hashBackupCodes(codes: string[]): Promise<string[]> {
	return Promise.all(codes.map((c) => sha256Hex(c)))
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
	const hash = await sha256Hex(code)
	let idx = -1
	for (let index = 0; index < hashedCodes.length; index += 1) {
		const matches = constantTimeEqual(hash, hashedCodes[index] ?? '')
		if (matches && idx === -1) idx = index
	}
	if (idx === -1) return { valid: false }
	return { valid: true, hash, index: idx }
}
