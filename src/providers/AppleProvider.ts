import { errorContext, resolveLogger, type Logger } from '../_internal/logger.ts'
import { requestOAuthTokenRevocation, requestOAuthTokens } from '../_internal/oauth2.ts'
import type { OAuthProfile, OAuthTokens } from '../types/index.ts'
import { AppleJwt } from './_appleJwt.ts'
import {
	normalizeAppleServerNotification,
	type AppleServerNotification
} from './_appleNotifications.ts'
import { OAuthProvider } from './OAuthProvider.ts'

export type { AppleServerNotification, AppleServerNotificationType } from './_appleNotifications.ts'

type AppleProviderConfig = {
	clientId: string
	teamId: string
	keyId: string
	privateKey: string
	callbackUrl: string
	logger?: Logger
}

const APPLE_AUTHORIZATION_ENDPOINT = 'https://appleid.apple.com/auth/authorize'
const APPLE_TOKEN_ENDPOINT = 'https://appleid.apple.com/auth/token'
const APPLE_REVOCATION_ENDPOINT = 'https://appleid.apple.com/auth/revoke'
const APPLE_IDENTITY_SCOPES = new Set(['name', 'email'])

/** Sign in with Apple OAuth provider. */
export class AppleProvider extends OAuthProvider {
	override readonly callbackMode = 'form_post' as const
	readonly #clientId: string
	readonly #callbackUrl: string
	readonly #logger: Logger
	readonly #jwt: AppleJwt

	constructor(config: AppleProviderConfig) {
		super('apple')
		this.#logger = resolveLogger(config.logger)
		if (
			!config.clientId ||
			!config.teamId ||
			!config.keyId ||
			!config.privateKey ||
			!config.callbackUrl
		) {
			throw new Error('AppleProvider requires clientId, teamId, keyId, privateKey, and callbackUrl')
		}

		this.#clientId = config.clientId
		this.#callbackUrl = config.callbackUrl
		this.#jwt = new AppleJwt({
			clientId: config.clientId,
			teamId: config.teamId,
			keyId: config.keyId,
			privateKey: config.privateKey,
			logger: this.#logger
		})
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
		authorizationUrl.searchParams.set('client_id', this.#clientId)
		authorizationUrl.searchParams.set('redirect_uri', this.#callbackUrl)
		authorizationUrl.searchParams.set('state', state)
		authorizationUrl.searchParams.set('nonce', codeVerifier)
		authorizationUrl.searchParams.set('scope', resolvedScopes.join(' '))
		return authorizationUrl
	}

	async getUserProfile(
		code: string,
		codeVerifier: string,
		userData: string | null = null
	): Promise<{ profile: OAuthProfile; tokens: OAuthTokens }> {
		try {
			const tokens = await this.#requestTokens(
				new URLSearchParams({
					grant_type: 'authorization_code',
					code,
					redirect_uri: this.#callbackUrl
				})
			)
			if (!tokens.idToken) throw new Error('Missing Apple ID token')
			const {
				email,
				email_verified: emailVerified,
				sub: appleUserId
			} = await this.#jwt.verifyIdToken(tokens.idToken, codeVerifier)
			if (!email || !appleUserId) throw new Error('Invalid token data from Apple')
			if (emailVerified !== true && emailVerified !== 'true') {
				throw new Error('Apple email not verified')
			}
			const name = readAppleDisplayName(userData, this.#logger)

			return {
				profile: {
					id: appleUserId,
					email,
					...(name ? { name } : {}),
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
			this.#logger.error('Error in AppleProvider.getUserProfile', errorContext(error))
			throw error
		}
	}

	/** Verifies and normalizes a Sign in with Apple server-to-server notification JWT. */
	async verifyServerNotification(token: string): Promise<AppleServerNotification> {
		const payload = await this.#jwt.verifySignedPayload(token, {
			requiredClaims: ['iss', 'aud', 'iat', 'jti', 'events'],
			errorMessage: 'Invalid Apple server notification'
		})
		return normalizeAppleServerNotification(payload)
	}

	async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
		const newTokens = await this.#requestTokens(
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
		await requestOAuthTokenRevocation({
			endpoint: APPLE_REVOCATION_ENDPOINT,
			parameters: new URLSearchParams({
				client_id: this.#clientId,
				client_secret: await this.#jwt.createClientSecret(),
				token: tokens.refreshToken ?? tokens.accessToken,
				token_type_hint: tokens.refreshToken ? 'refresh_token' : 'access_token'
			}),
			terminalErrorCodes: ['invalid_grant', 'invalid_token']
		})
	}

	async #requestTokens(parameters: URLSearchParams) {
		parameters.set('client_id', this.#clientId)
		parameters.set('client_secret', await this.#jwt.createClientSecret())
		return requestOAuthTokens(APPLE_TOKEN_ENDPOINT, parameters)
	}
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

function readAppleDisplayName(userData: string | null, logger: Logger): string | undefined {
	if (!userData) return undefined
	if (userData.length > 16 * 1024) throw new Error('Apple user data is too large')
	try {
		const userJson: unknown = JSON.parse(userData)
		if (!isRecord(userJson) || !isRecord(userJson['name'])) return undefined
		const appleName = userJson['name']
		const firstName = boundedString(appleName['firstName'], 256)
		const lastName = boundedString(appleName['lastName'], 256)
		const fullName = `${firstName} ${lastName}`.trim()
		return fullName && fullName.length <= 512 ? fullName : undefined
	} catch (error) {
		logger.warn('Could not parse Apple user data', errorContext(error))
		return undefined
	}
}

function boundedString(value: unknown, maxLength: number): string {
	return typeof value === 'string' && value.length <= maxLength ? value : ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}
