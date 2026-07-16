import type { OAuthTokens } from '../../types/index.ts'
import type { OAuthTokenCipherContext, OAuthTokenCodec } from './OAuthTokenCodec.ts'

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Normalizes persisted OAuth token data without inventing missing security fields. */
export function normalizeOAuthTokens(value: unknown): OAuthTokens | null {
	if (!isRecord(value) || typeof value['accessToken'] !== 'string') return null
	if (value['refreshToken'] !== null && typeof value['refreshToken'] !== 'string') return null
	if (value['scope'] !== null && typeof value['scope'] !== 'string') return null
	if (typeof value['accessTokenExpiresAt'] !== 'string') return null
	return {
		accessToken: value['accessToken'],
		refreshToken: value['refreshToken'],
		scope: value['scope'],
		accessTokenExpiresAt: value['accessTokenExpiresAt']
	}
}

export function parseOAuthTokensJson(value: string): OAuthTokens | null {
	try {
		return normalizeOAuthTokens(JSON.parse(value))
	} catch {
		return null
	}
}

export async function serializeOAuthTokens(
	tokens: OAuthTokens,
	codec: OAuthTokenCodec | null,
	context: OAuthTokenCipherContext
): Promise<string> {
	return codec ? codec.encrypt(tokens, context) : JSON.stringify(tokens)
}

export async function openOAuthTokens({
	value,
	codec,
	context,
	reseal
}: {
	value: string
	codec: OAuthTokenCodec | null
	context: OAuthTokenCipherContext
	reseal?: (ciphertext: string) => Promise<void>
}): Promise<OAuthTokens | null> {
	if (!codec) return parseOAuthTokensJson(value)
	const opened = await codec.decrypt(value, context)
	const tokens = normalizeOAuthTokens(opened?.value)
	if (!opened || !tokens) return null
	if (opened.needsReseal && reseal) {
		await reseal(await codec.encrypt(tokens, context))
	}
	return tokens
}
