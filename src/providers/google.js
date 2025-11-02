import { OAuthProvider } from "./base.js";
import { Google } from "arctic";

/**
 * Google OAuth Provider
 * Implements OAuth 2.0 authentication with Google
 */
export class GoogleProvider extends OAuthProvider {
	/**
	 * @param {Object} config - Configuration
	 * @param {string} config.clientId - Google OAuth client ID
	 * @param {string} config.clientSecret - Google OAuth client secret
	 * @param {string} config.callbackUrl - OAuth callback URL
	 * @param {string[]} [config.scopes] - Default OAuth scopes
	 */
	constructor(config) {
		super("google", config);

		if (!config.clientId || !config.clientSecret || !config.callbackUrl) {
			throw new Error(
				"GoogleProvider requires clientId, clientSecret, and callbackUrl",
			);
		}

		this.client = new Google(
			config.clientId,
			config.clientSecret,
			config.callbackUrl,
		);

		this.defaultScopes = config.scopes || [
			"openid",
			"profile",
			"email",
		];
	}

	createAuthorizationURL(state, codeVerifier, scopes) {
		const requestedScopes = scopes || this.defaultScopes;
		return this.client.createAuthorizationURL(
			state,
			codeVerifier,
			requestedScopes,
		);
	}

	async getUserProfile(code, codeVerifier) {
		try {
			const tokens = await this.client.validateAuthorizationCode(
				code,
				codeVerifier,
			);

			const googleUserResponse = await fetch(
				"https://www.googleapis.com/oauth2/v1/userinfo?alt=json",
				{
					headers: {
						Authorization: `Bearer ${tokens.accessToken()}`,
					},
				},
			);

			const googleUser = await googleUserResponse.json();

			if (!googleUser.verified_email) {
				throw new Error("Google email not verified");
			}

			return {
				profile: {
					id: googleUser.id,
					email: googleUser.email,
					name: googleUser.name,
					picture: googleUser.picture,
					verified_email: googleUser.verified_email,
				},
				tokens: {
					accessToken: tokens.data.access_token,
					refreshToken: tokens.data.refresh_token,
					scope: tokens.data.scope,
					accessTokenExpiresAt: new Date(
						Date.now() + tokens.data.expires_in * 1000,
					).toISOString(),
				},
			};
		} catch (error) {
			console.error("Error in GoogleProvider.getUserProfile:", error);
			throw error;
		}
	}

	async refreshAccessToken(refreshToken) {
		const newTokens = await this.client.refreshAccessToken(refreshToken);

		return {
			accessToken: newTokens.accessToken(),
			refreshToken: newTokens.refreshToken(),
			scope: newTokens.scope,
			accessTokenExpiresAt: new Date(
				Date.now() + newTokens.expiresIn * 1000,
			).toISOString(),
		};
	}
}
