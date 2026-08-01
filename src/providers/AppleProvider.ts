import {
	base64UrlToBytes,
	bytesToBase64Url,
	bytesToText,
	textToBytes
} from '@goobits/security/crypto'

import { errorContext, resolveLogger, type Logger } from '../_internal/logger.ts'
import { readBoundedResponseText, requestOAuthTokens } from '../_internal/oauth2.ts'
import type { OAuthProfile, OAuthTokens } from '../types/index.ts'
import { OAuthProvider } from './OAuthProvider.ts'

type AppleProviderConfig = {
	clientId: string
	teamId: string
	keyId: string
	privateKey: string
	callbackUrl: string
	logger?: Logger
}

type AppleIdTokenPayload = {
	iss?: string
	aud?: string | string[]
	exp?: number
	iat?: number
	nbf?: number
	email?: string
	email_verified?: boolean | string
	sub?: string
}

type AppleJwk = JsonWebKey & {
	alg?: string
	kid?: string
	use?: string
}

const APPLE_ISSUER = 'https://appleid.apple.com'
const APPLE_AUTHORIZATION_ENDPOINT = 'https://appleid.apple.com/auth/authorize'
const APPLE_TOKEN_ENDPOINT = 'https://appleid.apple.com/auth/token'
const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys'
const APPLE_CLOCK_SKEW_SECONDS = 5 * 60
const APPLE_JWKS_MAX_BYTES = 128 * 1024
let cachedAppleJwks: { keys: AppleJwk[]; expiresAt: number } | null = null

/**
 * Apple OAuth Provider
 * Implements Sign in with Apple
 */
export class AppleProvider extends OAuthProvider {
	override readonly callbackMode = 'form_post' as const
	private readonly clientId: string
	private readonly teamId: string
	private readonly keyId: string
	private readonly privateKeyBytes: Uint8Array
	private readonly callbackUrl: string
	private readonly logger: Logger
	private signingKeyPromise: Promise<CryptoKey> | null = null

	/**
	 * @param {Object} config - Configuration
	 * @param {string} config.clientId - Apple Services ID
	 * @param {string} config.teamId - Apple Team ID
	 * @param {string} config.keyId - Apple Key ID
	 * @param {string} config.privateKey - Apple Private Key (base64 encoded)
	 * @param {string} config.callbackUrl - OAuth callback URL
	 */
	constructor(config: AppleProviderConfig) {
		super('apple', config)
		this.logger = resolveLogger(config.logger)

		if (
			!config.clientId ||
			!config.teamId ||
			!config.keyId ||
			!config.privateKey ||
			!config.callbackUrl
		) {
			throw new Error('AppleProvider requires clientId, teamId, keyId, privateKey, and callbackUrl')
		}

		this.clientId = config.clientId
		this.teamId = config.teamId
		this.keyId = config.keyId
		this.privateKeyBytes = this._decodePrivateKey(config.privateKey)
		this.callbackUrl = config.callbackUrl
	}

	/**
	 * Decode base64 private key
	 * @param {string} privateKey - Base64 encoded private key
	 * @returns {Uint8Array}
	 * @private
	 */
	_decodePrivateKey(privateKey: string): Uint8Array {
		try {
			const cleaned = privateKey
				.replace('-----BEGIN PRIVATE KEY-----', '')
				.replace('-----END PRIVATE KEY-----', '')
				.replaceAll('\r', '')
				.replaceAll('\n', '')
				.trim()

			return base64UrlToBytes(cleaned.replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, ''))
		} catch (error) {
			this.logger.error('Error decoding Apple private key', errorContext(error))
			throw new Error('Invalid Apple private key format')
		}
	}

	createAuthorizationURL(
		state: string,
		_codeVerifier: string,
		scopes: string[] = ['name', 'email']
	): URL {
		const authorizationUrl = new URL(APPLE_AUTHORIZATION_ENDPOINT)
		authorizationUrl.searchParams.set('response_type', 'code')
		authorizationUrl.searchParams.set('response_mode', 'form_post')
		authorizationUrl.searchParams.set('client_id', this.clientId)
		authorizationUrl.searchParams.set('redirect_uri', this.callbackUrl)
		authorizationUrl.searchParams.set('state', state)
		authorizationUrl.searchParams.set(
			'scope',
			(scopes.length > 0 ? scopes : ['name', 'email']).join(' ')
		)
		return authorizationUrl
	}

	/**
	 * Get user profile from Apple
	 * @param {string} code - Authorization code
	 * @param {string} codeVerifier - PKCE code verifier
	 * @param {string} [userData] - Optional user data from first-time sign in (JSON string)
	 * @returns {Promise<{profile: Object, tokens: Object}>}
	 */
	async getUserProfile(
		code: string,
		_codeVerifier: string,
		userData: string | null = null
	): Promise<{ profile: OAuthProfile; tokens: OAuthTokens }> {
		try {
			const tokens = await this.requestTokens(
				new URLSearchParams({
					grant_type: 'authorization_code',
					code,
					redirect_uri: this.callbackUrl
				})
			)
			if (!tokens.idToken) throw new Error('Missing Apple ID token')

			const {
				email,
				email_verified: emailVerified,
				sub: appleUserId
			} = await this.verifyIdToken(tokens.idToken)

			if (!email || !appleUserId) {
				throw new Error('Invalid token data from Apple')
			}
			const isEmailVerified = emailVerified === true || emailVerified === 'true'
			if (!isEmailVerified) {
				throw new Error('Apple email not verified')
			}

			let name = undefined

			// Handle first-time sign in data if present
			if (userData) {
				if (userData.length > 16 * 1024) throw new Error('Apple user data is too large')
				try {
					const userJson = JSON.parse(userData)
					if (userJson.name) {
						const firstName = userJson.name.firstName || ''
						const lastName = userJson.name.lastName || ''
						const fullName = `${firstName} ${lastName}`.trim()
						if (fullName) name = fullName
					}
				} catch (error) {
					this.logger.warn('Could not parse Apple user data', errorContext(error))
				}
			}

			return {
				profile: {
					id: appleUserId,
					email: email as string,
					...(name && { name }),
					verified_email: true
				},
				tokens: {
					accessToken: tokens.accessToken,
					refreshToken: tokens.refreshToken,
					scope: tokens.scope,
					accessTokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000).toISOString()
				}
			}
		} catch (error) {
			this.logger.error('Error in AppleProvider.getUserProfile', errorContext(error))
			throw error
		}
	}

	private async requestTokens(parameters: URLSearchParams) {
		parameters.set('client_id', this.clientId)
		parameters.set('client_secret', await this.createClientSecret())
		return requestOAuthTokens(APPLE_TOKEN_ENDPOINT, parameters)
	}

	private async createClientSecret(): Promise<string> {
		const now = Math.floor(Date.now() / 1000)
		const header = bytesToBase64Url(
			textToBytes(JSON.stringify({ alg: 'ES256', kid: this.keyId, typ: 'JWT' }))
		)
		const claims = bytesToBase64Url(
			textToBytes(
				JSON.stringify({
					iss: this.teamId,
					iat: now,
					exp: now + 5 * 60,
					aud: APPLE_ISSUER,
					sub: this.clientId
				})
			)
		)
		const signingInput = `${header}.${claims}`
		const signature = await crypto.subtle.sign(
			{ name: 'ECDSA', hash: 'SHA-256' },
			await this.getSigningKey(),
			Uint8Array.from(textToBytes(signingInput)).buffer
		)
		const signatureBytes = new Uint8Array(signature)
		if (signatureBytes.byteLength !== 64) {
			throw new Error('Apple client secret signature is invalid')
		}
		return `${signingInput}.${bytesToBase64Url(signatureBytes)}`
	}

	private getSigningKey(): Promise<CryptoKey> {
		this.signingKeyPromise ??= crypto.subtle.importKey(
			'pkcs8',
			Uint8Array.from(this.privateKeyBytes).buffer,
			{ name: 'ECDSA', namedCurve: 'P-256' },
			false,
			['sign']
		)
		return this.signingKeyPromise
	}

	private async verifyIdToken(idTokenValue: string): Promise<AppleIdTokenPayload> {
		if (idTokenValue.length > 16 * 1024) {
			throw new Error('Apple ID token is too large')
		}

		const [headerPart, payloadPart, signaturePart] = idTokenValue.split('.')
		if (!headerPart || !payloadPart || !signaturePart) {
			throw new Error('Invalid Apple ID token format')
		}

		const header = parseJwtPart(headerPart) as { alg?: string; kid?: string }
		if (header.alg !== 'RS256' || !header.kid) {
			throw new Error('Unsupported Apple ID token header')
		}

		let jwks = await getAppleJwks()
		let jwk = jwks.keys.find((key) => key.kid === header.kid)
		if (!jwk) {
			jwks = await getAppleJwks(true)
			jwk = jwks.keys.find((key) => key.kid === header.kid)
		}
		if (!jwk) {
			throw new Error('Apple ID token key not found')
		}

		const key = await crypto.subtle.importKey(
			'jwk',
			jwk,
			{ name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
			false,
			['verify']
		)
		const signingInput = new TextEncoder().encode(`${headerPart}.${payloadPart}`)
		const signature = new Uint8Array(base64UrlToBytes(signaturePart))
		const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, signingInput)
		if (!valid) {
			throw new Error('Invalid Apple ID token signature')
		}

		const payload = parseJwtPart(payloadPart) as AppleIdTokenPayload
		const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud]
		const nowSeconds = Math.floor(Date.now() / 1000)
		if (payload.iss !== APPLE_ISSUER) {
			throw new Error('Invalid Apple ID token issuer')
		}
		if (!audience.includes(this.clientId)) {
			throw new Error('Invalid Apple ID token audience')
		}
		if (!payload.exp || payload.exp <= nowSeconds) {
			throw new Error('Expired Apple ID token')
		}
		if (payload.iat && payload.iat > nowSeconds + APPLE_CLOCK_SKEW_SECONDS) {
			throw new Error('Invalid Apple ID token issued-at time')
		}
		if (payload.nbf && payload.nbf > nowSeconds + APPLE_CLOCK_SKEW_SECONDS) {
			throw new Error('Apple ID token is not active')
		}
		if (
			typeof payload.sub !== 'string' ||
			!payload.sub ||
			payload.sub.length > 255 ||
			typeof payload.email !== 'string' ||
			!payload.email ||
			payload.email.length > 320
		) {
			throw new Error('Invalid Apple ID token identity')
		}
		return payload
	}

	async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
		const newTokens = await this.requestTokens(
			new URLSearchParams({
				grant_type: 'refresh_token',
				refresh_token: refreshToken
			})
		)

		return {
			accessToken: newTokens.accessToken,
			refreshToken: newTokens.refreshToken,
			scope: newTokens.scope,
			accessTokenExpiresAt: new Date(Date.now() + newTokens.expiresIn * 1000).toISOString()
		}
	}
}

function parseJwtPart(value: string): unknown {
	return JSON.parse(bytesToText(base64UrlToBytes(value)))
}

async function getAppleJwks(forceRefresh = false): Promise<{ keys: AppleJwk[] }> {
	const now = Date.now()
	if (!forceRefresh && cachedAppleJwks && cachedAppleJwks.expiresAt > now) {
		return { keys: cachedAppleJwks.keys }
	}
	const response = await fetch(APPLE_JWKS_URL, {
		signal: AbortSignal.timeout(5000),
		headers: { accept: 'application/json' }
	})
	if (!response.ok) {
		throw new Error(`Apple JWKS fetch failed (${response.status})`)
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
	if (keys.length === 0) throw new Error('Apple JWKS response contained no signing keys')
	cachedAppleJwks = { keys, expiresAt: now + 60 * 60 * 1000 }
	return { keys }
}
