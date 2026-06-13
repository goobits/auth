import {
	bytesToHex,
	constantTimeEqual as securityConstantTimeEqual,
	randomBytes,
	sha256Hex
} from '@goobits/security/crypto'

export function timingSafeEqual(a: string, b: string): boolean {
	if (!a || !b) return false
	return securityConstantTimeEqual(a, b)
}

export async function createAdminApiKey({
	prefix = 'adm',
	bytes = 32
}: { prefix?: string; bytes?: number } = {}): Promise<string> {
	const random = randomBytes(bytes)
	return `${ prefix }_${ bytesToHex(random) }`
}

export async function hashAdminApiKey(
	apiKey: string,
	{ salt = '' }: { salt?: string } = {}
): Promise<string> {
	if (!apiKey) throw new Error('apiKey is required')
	return sha256Hex(`${ salt }${ apiKey }`)
}

export async function verifyAdminApiKey(
	apiKey: string,
	hashed: string,
	{ salt = '' }: { salt?: string } = {}
): Promise<boolean> {
	if (!apiKey || !hashed) return false
	const candidate = await hashAdminApiKey(apiKey, { salt })
	return timingSafeEqual(candidate, hashed)
}

export function parseApiKeyHeader(value: string | null): string | null {
	if (!value) return null
	if (value.startsWith('ApiKey ')) return value.slice(7)
	if (value.startsWith('Bearer ')) return value.slice(7)
	return value
}
