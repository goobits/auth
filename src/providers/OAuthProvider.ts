import type { OAuthProfile, OAuthTokens } from '../types/core.ts'

/** Secret-free provider metadata safe to expose through Auth facades. */
export type OAuthProviderMetadata = Readonly<{
	name: string
	callbackMode: 'query' | 'form_post'
}>

/**
 * Base OAuth Provider Interface.
 * All OAuth providers must extend this class and implement its abstract methods.
 */
export abstract class OAuthProvider {
	readonly name: string
	readonly callbackMode: 'query' | 'form_post' = 'query'

	constructor(name: string) {
		this.name = name
	}

	/**
	 * Build the authorization URL the user should be redirected to.
	 * @param state - CSRF state token to include in the URL
	 * @param codeVerifier - PKCE code verifier
	 * @param scopes - OAuth scopes to request
	 */
	abstract createAuthorizationURL(
		state: string,
		codeVerifier: string,
		scopes: string[]
	): URL | Promise<URL>

	/**
	 * Exchange the authorization code for tokens and resolve the user profile.
	 * @param code - Authorization code returned by the provider
	 * @param codeVerifier - PKCE code verifier matching `createAuthorizationURL`
	 * @param userData - Optional provider-specific user data (e.g. Apple's `user` form field)
	 */
	abstract getUserProfile(
		code: string,
		codeVerifier: string,
		userData?: string | null
	): Promise<{ profile: OAuthProfile; tokens: OAuthTokens }>

	/**
	 * Refresh an access token. Throw if the provider doesn't support refresh.
	 *
	 * @param refreshToken - refresh token value.
	 */
	abstract refreshAccessToken(refreshToken: string): Promise<OAuthTokens>

	/** Revoke retained provider credentials before an identity is unlinked. */
	abstract revokeTokens(tokens: OAuthTokens): Promise<void>
}
