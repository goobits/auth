import { bytesToHex, randomBytes, sha256Hex } from '@goobits/security/crypto'

import { timingSafeEqual } from '../utils/crypto.ts'

/** Creates a random auth API key with a prefix. */
export async function createAuthApiKey({
	prefix = 'auth',
	bytes = 32
}: { prefix?: string; bytes?: number } = {}): Promise<string> {
	const random = randomBytes(bytes)
	return `${prefix}_${bytesToHex(random)}`
}

/** Hashes an auth API key with an optional salt. */
export async function hashAuthApiKey(
	apiKey: string,
	{ salt = '' }: { salt?: string } = {}
): Promise<string> {
	if (!apiKey) throw new Error('apiKey is required')
	return sha256Hex(`${salt}${apiKey}`)
}

/** Verifies an auth API key against a stored hash. */
export async function verifyAuthApiKey(
	apiKey: string,
	hashed: string,
	{ salt = '' }: { salt?: string } = {}
): Promise<boolean> {
	if (!apiKey || !hashed) return false
	const candidate = await hashAuthApiKey(apiKey, { salt })
	return timingSafeEqual(candidate, hashed)
}

/** Extracts an API key from ApiKey, Bearer, or raw header values. */
export function parseApiKeyHeader(value: string | null): string | null {
	if (!value) return null
	if (value.startsWith('ApiKey ')) return value.slice(7)
	if (value.startsWith('Bearer ')) return value.slice(7)
	return value
}
