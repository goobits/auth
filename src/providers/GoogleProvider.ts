import {
	createS256CodeChallenge,
	readBoundedResponseText,
	requestOAuthTokens
} from '../_internal/oauth2.ts'
import { errorContext, resolveLogger, type Logger } from '../_internal/logger.ts'
import type { OAuthProfile, OAuthTokens } from '../types/index.ts'
import { OAuthProvider } from './OAuthProvider.ts'

const GOOGLE_AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v1/userinfo?alt=json'
const GOOGLE_USERINFO_MAX_BYTES = 64 * 1024

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

type GoogleProviderConfig = {
	clientId: string
	clientSecret: string
	callbackUrl: string
	scopes?: string[]
	logger?: Logger
}

/** Google OAuth 2.0 provider with PKCE authorization-code exchange. */
export class GoogleProvider extends OAuthProvider {
	private readonly clientId: string
	private readonly clientSecret: string
	private readonly callbackUrl: string
	private readonly defaultScopes: string[]
	private readonly logger: Logger

	constructor(config: GoogleProviderConfig) {
		super('google', config)
		this.logger = resolveLogger(config.logger)

		if (!config.clientId || !config.clientSecret || !config.callbackUrl) {
			throw new Error('GoogleProvider requires clientId, clientSecret, and callbackUrl')
		}

		this.clientId = config.clientId
		this.clientSecret = config.clientSecret
		this.callbackUrl = config.callbackUrl
		this.defaultScopes = config.scopes ?? ['openid', 'profile', 'email']
	}

	async createAuthorizationURL(
		state: string,
		codeVerifier: string,
		scopes: string[] = this.defaultScopes
	): Promise<URL> {
		const authorizationUrl = new URL(GOOGLE_AUTHORIZATION_ENDPOINT)
		authorizationUrl.searchParams.set('response_type', 'code')
		authorizationUrl.searchParams.set('client_id', this.clientId)
		authorizationUrl.searchParams.set('redirect_uri', this.callbackUrl)
		authorizationUrl.searchParams.set('state', state)
		authorizationUrl.searchParams.set(
			'scope',
			(scopes.length > 0 ? scopes : this.defaultScopes).join(' ')
		)
		authorizationUrl.searchParams.set('code_challenge', await createS256CodeChallenge(codeVerifier))
		authorizationUrl.searchParams.set('code_challenge_method', 'S256')
		return authorizationUrl
	}

	async getUserProfile(
		code: string,
		codeVerifier: string
	): Promise<{ profile: OAuthProfile; tokens: OAuthTokens }> {
		try {
			const tokenSet = await requestOAuthTokens(
				GOOGLE_TOKEN_ENDPOINT,
				new URLSearchParams({
					grant_type: 'authorization_code',
					code,
					redirect_uri: this.callbackUrl,
					code_verifier: codeVerifier,
					client_id: this.clientId,
					client_secret: this.clientSecret
				})
			)
			const googleUserResponse = await fetch(GOOGLE_USERINFO_ENDPOINT, {
				headers: { Authorization: `Bearer ${tokenSet.accessToken}` },
				signal: AbortSignal.timeout(10_000)
			})
			if (!googleUserResponse.ok) {
				throw new Error(`Google user info request failed (${googleUserResponse.status})`)
			}
			const googleUserText = await readBoundedResponseText(
				googleUserResponse,
				GOOGLE_USERINFO_MAX_BYTES,
				'Google user info response'
			)
			let googleUser: unknown
			try {
				googleUser = JSON.parse(googleUserText)
			} catch {
				throw new Error('Invalid Google user profile')
			}
			if (
				!isRecord(googleUser) ||
				typeof googleUser['id'] !== 'string' ||
				typeof googleUser['email'] !== 'string' ||
				typeof googleUser['name'] !== 'string' ||
				(googleUser['picture'] !== undefined && typeof googleUser['picture'] !== 'string') ||
				typeof googleUser['verified_email'] !== 'boolean'
			) {
				throw new Error('Invalid Google user profile')
			}
			if (!googleUser['verified_email']) throw new Error('Google email not verified')

			const profile: OAuthProfile = {
				id: googleUser['id'],
				email: googleUser['email'],
				name: googleUser['name'],
				verified_email: true,
				...(googleUser['picture'] ? { picture: googleUser['picture'] } : {})
			}
			return {
				profile,
				tokens: {
					accessToken: tokenSet.accessToken,
					refreshToken: tokenSet.refreshToken,
					scope: tokenSet.scope,
					accessTokenExpiresAt: new Date(Date.now() + tokenSet.expiresIn * 1000).toISOString()
				}
			}
		} catch (error) {
			this.logger.error('Error in GoogleProvider.getUserProfile', errorContext(error))
			throw error
		}
	}

	async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
		const tokenSet = await requestOAuthTokens(
			GOOGLE_TOKEN_ENDPOINT,
			new URLSearchParams({
				grant_type: 'refresh_token',
				refresh_token: refreshToken,
				client_id: this.clientId,
				client_secret: this.clientSecret
			})
		)
		return {
			accessToken: tokenSet.accessToken,
			refreshToken: tokenSet.refreshToken,
			scope: tokenSet.scope,
			accessTokenExpiresAt: new Date(Date.now() + tokenSet.expiresIn * 1000).toISOString()
		}
	}
}
