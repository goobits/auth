import { base64UrlToBytes, bytesToBase64Url, textToBytes } from '@goobits/security/crypto'
import { verifyJwtWithJwks } from '@goobits/security/jwt'

import { errorContext, type Logger } from '../_internal/logger.ts'
import {
	OAuth2RequestError,
	readBoundedResponseText,
	requestOAuthResponse
} from '../_internal/oauth2.ts'

type AppleIdTokenPayload = {
	iss?: string
	aud?: string | string[]
	exp?: number
	iat?: number
	nbf?: number
	nonce?: string
	email?: string
	email_verified?: boolean | string
	sub?: string
}

type AppleJwk = JsonWebKey & {
	alg?: string
	kid?: string
	use?: string
}

type AppleJwtConfig = {
	clientId: string
	teamId: string
	keyId: string
	privateKey: string
	logger: Logger
}

export const APPLE_ISSUER = 'https://appleid.apple.com'
export const APPLE_CLOCK_SKEW_SECONDS = 5 * 60
const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys'
const APPLE_JWKS_MAX_BYTES = 128 * 1024
const APPLE_JWKS_TTL_MS = 60 * 60 * 1000
const APPLE_JWKS_UNKNOWN_KEY_COOLDOWN_MS = 60 * 1000
const APPLE_JWKS_FAILURE_BACKOFF_MS = 30 * 1000

let cachedAppleJwks: { keys: AppleJwk[]; expiresAt: number } | null = null
let appleJwksFetchPromise: Promise<{ keys: AppleJwk[] }> | null = null
let nextForcedAppleJwksRefreshAt = 0
let nextAppleJwksFetchAt = 0

export class AppleJwt {
	readonly #clientId: string
	readonly #teamId: string
	readonly #keyId: string
	readonly #privateKeyBytes: Uint8Array
	#signingKeyPromise: Promise<CryptoKey> | null = null

	constructor({ clientId, teamId, keyId, privateKey, logger }: AppleJwtConfig) {
		this.#clientId = clientId
		this.#teamId = teamId
		this.#keyId = keyId
		this.#privateKeyBytes = decodePrivateKey(privateKey, logger)
	}

	async createClientSecret(): Promise<string> {
		const now = Math.floor(Date.now() / 1000)
		const header = bytesToBase64Url(
			textToBytes(JSON.stringify({ alg: 'ES256', kid: this.#keyId, typ: 'JWT' }))
		)
		const claims = bytesToBase64Url(
			textToBytes(
				JSON.stringify({
					iss: this.#teamId,
					iat: now,
					exp: now + 5 * 60,
					aud: APPLE_ISSUER,
					sub: this.#clientId
				})
			)
		)
		const signingInput = `${header}.${claims}`
		const signature = await crypto.subtle.sign(
			{ name: 'ECDSA', hash: 'SHA-256' },
			await this.#getSigningKey(),
			Uint8Array.from(textToBytes(signingInput)).buffer
		)
		const signatureBytes = new Uint8Array(signature)
		if (signatureBytes.byteLength !== 64) {
			throw new Error('Apple client secret signature is invalid')
		}
		return `${signingInput}.${bytesToBase64Url(signatureBytes)}`
	}

	async verifyIdToken(idToken: string, expectedNonce: string): Promise<AppleIdTokenPayload> {
		const payload = (await this.verifySignedPayload(idToken, {
			requiredClaims: ['iss', 'aud', 'sub', 'iat', 'exp', 'email', 'email_verified', 'nonce'],
			maxTokenAge: '10 minutes',
			errorMessage: 'Invalid Apple ID token'
		})) as AppleIdTokenPayload
		if (
			typeof payload.sub !== 'string' ||
			!payload.sub ||
			payload.sub.length > 255 ||
			typeof payload.email !== 'string' ||
			!payload.email ||
			payload.email.length > 320 ||
			payload.nonce !== expectedNonce
		) {
			throw new Error('Invalid Apple ID token identity')
		}
		return payload
	}

	async verifySignedPayload(
		token: string,
		options: {
			requiredClaims: readonly string[]
			maxTokenAge?: string | number
			errorMessage: string
		}
	): Promise<Record<string, unknown>> {
		if (!token || token.length > 16 * 1024) throw new Error(options.errorMessage)
		const readJwks = async (forceRefresh = false) => {
			try {
				return await getAppleJwks(forceRefresh)
			} catch {
				throw new Error(options.errorMessage)
			}
		}
		let jwks = await readJwks()
		const verify = (keySet: { keys: AppleJwk[] }) =>
			verifyJwtWithJwks(token, {
				jwks: keySet,
				algorithms: ['RS256'],
				issuer: APPLE_ISSUER,
				audience: this.#clientId,
				requiredClaims: options.requiredClaims,
				clockTolerance: APPLE_CLOCK_SKEW_SECONDS,
				...(options.maxTokenAge === undefined ? {} : { maxTokenAge: options.maxTokenAge })
			})
		let verification = await verify(jwks)
		if (!verification.ok && verification.reason === 'key-not-found') {
			jwks = await readJwks(true)
			verification = await verify(jwks)
		}
		if (!verification.ok) throw new Error(options.errorMessage)
		return verification.payload
	}

	#getSigningKey(): Promise<CryptoKey> {
		this.#signingKeyPromise ??= crypto.subtle.importKey(
			'pkcs8',
			Uint8Array.from(this.#privateKeyBytes).buffer,
			{ name: 'ECDSA', namedCurve: 'P-256' },
			false,
			['sign']
		)
		return this.#signingKeyPromise
	}
}

function decodePrivateKey(privateKey: string, logger: Logger): Uint8Array {
	try {
		const cleaned = privateKey
			.replace('-----BEGIN PRIVATE KEY-----', '')
			.replace('-----END PRIVATE KEY-----', '')
			.replaceAll('\r', '')
			.replaceAll('\n', '')
			.trim()
		return base64UrlToBytes(cleaned.replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, ''))
	} catch (error) {
		logger.error('Error decoding Apple private key', errorContext(error))
		throw new Error('Invalid Apple private key format')
	}
}

async function getAppleJwks(forceRefresh = false): Promise<{ keys: AppleJwk[] }> {
	const now = Date.now()
	if (!forceRefresh && cachedAppleJwks && cachedAppleJwks.expiresAt > now) {
		return { keys: cachedAppleJwks.keys }
	}
	if (appleJwksFetchPromise) return appleJwksFetchPromise
	if (now < nextAppleJwksFetchAt) {
		if (cachedAppleJwks) return { keys: cachedAppleJwks.keys }
		throw new OAuth2RequestError('apple_jwks_unavailable', null, 503)
	}
	if (forceRefresh && cachedAppleJwks && now < nextForcedAppleJwksRefreshAt) {
		return { keys: cachedAppleJwks.keys }
	}
	if (forceRefresh) nextForcedAppleJwksRefreshAt = now + APPLE_JWKS_UNKNOWN_KEY_COOLDOWN_MS

	const stale = cachedAppleJwks
	const pending = fetchAppleJwks()
	appleJwksFetchPromise = pending
	try {
		return await pending
	} catch (error) {
		nextAppleJwksFetchAt = Date.now() + APPLE_JWKS_FAILURE_BACKOFF_MS
		if (!stale) throw error
		return { keys: stale.keys }
	} finally {
		if (appleJwksFetchPromise === pending) appleJwksFetchPromise = null
	}
}

async function fetchAppleJwks(): Promise<{ keys: AppleJwk[] }> {
	try {
		const response = await requestOAuthResponse(APPLE_JWKS_URL, {
			signal: AbortSignal.timeout(5000),
			headers: { accept: 'application/json' }
		})
		if (!response.ok) {
			throw new OAuth2RequestError('apple_jwks_unavailable', null, response.status)
		}
		const responseText = await readBoundedResponseText(
			response,
			APPLE_JWKS_MAX_BYTES,
			'Apple JWKS response'
		)
		const body = JSON.parse(responseText) as { keys?: AppleJwk[] }
		const keys = Array.isArray(body.keys)
			? body.keys
					.filter(
						(key) =>
							key.kty === 'RSA' &&
							typeof key.kid === 'string' &&
							(!key.use || key.use === 'sig') &&
							(!key.alg || key.alg === 'RS256')
					)
					.slice(0, 10)
			: []
		if (keys.length === 0) throw new OAuth2RequestError('apple_jwks_invalid', null, 502)
		cachedAppleJwks = { keys, expiresAt: Date.now() + APPLE_JWKS_TTL_MS }
		nextAppleJwksFetchAt = 0
		nextForcedAppleJwksRefreshAt = Date.now() + APPLE_JWKS_UNKNOWN_KEY_COOLDOWN_MS
		return { keys }
	} catch (error) {
		if (error instanceof OAuth2RequestError) throw error
		throw new OAuth2RequestError('apple_jwks_invalid', null, 502)
	}
}
