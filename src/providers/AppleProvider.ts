import { base64UrlToBytes, bytesToBase64Url, textToBytes } from '@goobits/security/crypto'
import { verifyJwtWithJwks } from '@goobits/security/jwt'

import { errorContext, resolveLogger, type Logger } from '../_internal/logger.ts'
import {
	readBoundedResponseText,
	requestOAuthTokenRevocation,
	requestOAuthTokens
} from '../_internal/oauth2.ts'
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
	nonce?: string
	email?: string
	email_verified?: boolean | string
	sub?: string
}

type AppleServerNotificationPayload = {
	iss?: string
	aud?: string | string[]
	iat?: number
	jti?: string
	events?: unknown
}

export type AppleServerNotificationType =
	| 'email-disabled'
	| 'email-enabled'
	| 'consent-revoked'
	| 'account-deleted'

/** Verified, normalized Sign in with Apple account-change event. */
export type AppleServerNotification = {
	jwtId: string
	type: AppleServerNotificationType
	subject: string
	eventTime: number
	email?: string
	isPrivateEmail?: boolean
}

type AppleJwk = JsonWebKey & {
	alg?: string
	kid?: string
	use?: string
}

const APPLE_ISSUER = 'https://appleid.apple.com'
const APPLE_AUTHORIZATION_ENDPOINT = 'https://appleid.apple.com/auth/authorize'
const APPLE_TOKEN_ENDPOINT = 'https://appleid.apple.com/auth/token'
const APPLE_REVOCATION_ENDPOINT = 'https://appleid.apple.com/auth/revoke'
const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys'
const APPLE_CLOCK_SKEW_SECONDS = 5 * 60
const APPLE_JWKS_MAX_BYTES = 128 * 1024
const APPLE_EVENTS_MAX_BYTES = 8 * 1024
const APPLE_MILLISECONDS_THRESHOLD = 10_000_000_000
const APPLE_IDENTITY_SCOPES = new Set(['name', 'email'])
const APPLE_NOTIFICATION_TYPES = new Set<AppleServerNotificationType>([
	'email-disabled',
	'email-enabled',
	'consent-revoked',
	'account-deleted'
])
let cachedAppleJwks: { keys: AppleJwk[]; expiresAt: number } | null = null

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

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
		codeVerifier: string,
		scopes: string[] = ['name', 'email']
	): URL {
		const resolvedScopes = scopes.length > 0 ? scopes : ['name', 'email']
		assertIdentityScopes(resolvedScopes)
		const authorizationUrl = new URL(APPLE_AUTHORIZATION_ENDPOINT)
		authorizationUrl.searchParams.set('response_type', 'code')
		authorizationUrl.searchParams.set('response_mode', 'form_post')
		authorizationUrl.searchParams.set('client_id', this.clientId)
		authorizationUrl.searchParams.set('redirect_uri', this.callbackUrl)
		authorizationUrl.searchParams.set('state', state)
		authorizationUrl.searchParams.set('nonce', codeVerifier)
		authorizationUrl.searchParams.set('scope', resolvedScopes.join(' '))
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
		codeVerifier: string,
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
			} = await this.verifyIdToken(tokens.idToken, codeVerifier)

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
					const userJson: unknown = JSON.parse(userData)
					const appleName = isRecord(userJson) ? userJson['name'] : null
					if (isRecord(appleName)) {
						const firstName =
							typeof appleName['firstName'] === 'string' && appleName['firstName'].length <= 256
								? appleName['firstName']
								: ''
						const lastName =
							typeof appleName['lastName'] === 'string' && appleName['lastName'].length <= 256
								? appleName['lastName']
								: ''
						const fullName = `${firstName} ${lastName}`.trim()
						if (fullName && fullName.length <= 512) name = fullName
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

	private async verifyIdToken(
		idTokenValue: string,
		expectedNonce: string
	): Promise<AppleIdTokenPayload> {
		const payload = (await this.verifySignedApplePayload(idTokenValue, {
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

	private async verifySignedApplePayload(
		token: string,
		options: {
			requiredClaims: readonly string[]
			maxTokenAge?: string | number
			errorMessage: string
		}
	): Promise<Record<string, unknown>> {
		if (!token || token.length > 16 * 1024) throw new Error(options.errorMessage)
		let jwks = await getAppleJwks()
		const verify = (keySet: { keys: AppleJwk[] }) =>
			verifyJwtWithJwks(token, {
				jwks: keySet,
				algorithms: ['RS256'],
				issuer: APPLE_ISSUER,
				audience: this.clientId,
				requiredClaims: options.requiredClaims,
				clockTolerance: APPLE_CLOCK_SKEW_SECONDS,
				...(options.maxTokenAge === undefined ? {} : { maxTokenAge: options.maxTokenAge })
			})
		let verification = await verify(jwks)
		if (!verification.ok && verification.reason !== 'expired') {
			jwks = await getAppleJwks(true)
			verification = await verify(jwks)
		}
		if (!verification.ok) throw new Error(options.errorMessage)
		return verification.payload
	}

	/** Verifies and normalizes a Sign in with Apple server-to-server notification JWT. */
	async verifyServerNotification(token: string): Promise<AppleServerNotification> {
		const payload = (await this.verifySignedApplePayload(token, {
			requiredClaims: ['iss', 'aud', 'iat', 'jti', 'events'],
			errorMessage: 'Invalid Apple server notification'
		})) as AppleServerNotificationPayload
		const events = parseAppleEvents(payload.events)
		const type = events?.['type']
		const subject = events?.['sub']
		const eventTime = normalizeAppleEventTime(events?.['event_time'])
		const email = events?.['email']
		const privateEmail = events?.['is_private_email']
		const now = Math.floor(Date.now() / 1000)
		if (
			typeof payload.iat !== 'number' ||
			!Number.isSafeInteger(payload.iat) ||
			payload.iat <= 0 ||
			payload.iat > now + APPLE_CLOCK_SKEW_SECONDS ||
			typeof payload.jti !== 'string' ||
			payload.jti.length === 0 ||
			payload.jti.length > 512 ||
			typeof type !== 'string' ||
			!APPLE_NOTIFICATION_TYPES.has(type as AppleServerNotificationType) ||
			typeof subject !== 'string' ||
			subject.length === 0 ||
			subject.length > 255 ||
			eventTime === null ||
			eventTime > now + APPLE_CLOCK_SKEW_SECONDS ||
			(email !== undefined &&
				(typeof email !== 'string' || email.length === 0 || email.length > 320)) ||
			((type === 'email-enabled' || type === 'email-disabled') && typeof email !== 'string')
		) {
			throw new Error('Invalid Apple server notification')
		}

		const normalized: AppleServerNotification = {
			jwtId: payload.jti,
			type: type as AppleServerNotificationType,
			subject,
			eventTime
		}
		if (typeof email === 'string') normalized.email = email
		const isPrivateEmail = parseAppleBoolean(privateEmail)
		if (privateEmail !== undefined && isPrivateEmail === undefined) {
			throw new Error('Invalid Apple server notification')
		}
		if (isPrivateEmail !== undefined) normalized.isPrivateEmail = isPrivateEmail
		return normalized
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
			refreshToken: newTokens.refreshToken ?? refreshToken,
			scope: newTokens.scope,
			accessTokenExpiresAt: new Date(Date.now() + newTokens.expiresIn * 1000).toISOString()
		}
	}

	async revokeTokens(tokens: OAuthTokens): Promise<void> {
		const token = tokens.refreshToken ?? tokens.accessToken
		await requestOAuthTokenRevocation({
			endpoint: APPLE_REVOCATION_ENDPOINT,
			parameters: new URLSearchParams({
				client_id: this.clientId,
				client_secret: await this.createClientSecret(),
				token,
				token_type_hint: tokens.refreshToken ? 'refresh_token' : 'access_token'
			}),
			terminalErrorCodes: ['invalid_grant', 'invalid_token']
		})
	}
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

function assertIdentityScopes(scopes: readonly string[]): void {
	if (
		scopes.length === 0 ||
		new Set(scopes).size !== scopes.length ||
		scopes.some((scope) => !APPLE_IDENTITY_SCOPES.has(scope)) ||
		!scopes.includes('email')
	) {
		throw new Error('AppleProvider supports only the name and email identity scopes')
	}
}

function parseAppleBoolean(value: unknown): boolean | undefined {
	if (value === true || value === 'true') return true
	if (value === false || value === 'false') return false
	return undefined
}

function parseAppleEvents(value: unknown): Record<string, unknown> | null {
	if (isRecord(value)) return value
	if (typeof value !== 'string' || value.length === 0 || value.length > APPLE_EVENTS_MAX_BYTES) {
		return null
	}
	try {
		const parsed: unknown = JSON.parse(value)
		return isRecord(parsed) ? parsed : null
	} catch {
		return null
	}
}

/** Normalizes Apple's documented seconds and legacy millisecond event timestamps. */
function normalizeAppleEventTime(value: unknown): number | null {
	if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) return null
	return value >= APPLE_MILLISECONDS_THRESHOLD ? Math.floor(value / 1000) : value
}
