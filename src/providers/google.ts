import { OAuthProvider } from "./base.ts";
import { Google } from "arctic";
import type { OAuthProfile, OAuthTokens } from "../types/index.ts";

type GoogleProviderConfig = {
	clientId: string;
	clientSecret: string;
	callbackUrl: string;
	scopes?: string[];
};

/**
 * Google OAuth Provider
 * Implements OAuth 2.0 authentication with Google
 */
export class GoogleProvider extends OAuthProvider {
	private client: Google;
	private defaultScopes: string[];

	/**
	 * @param {Object} config - Configuration
	 * @param {string} config.clientId - Google OAuth client ID
	 * @param {string} config.clientSecret - Google OAuth client secret
	 * @param {string} config.callbackUrl - OAuth callback URL
	 * @param {string[]} [config.scopes] - Default OAuth scopes
	 */
	constructor(config: GoogleProviderConfig) {
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

	createAuthorizationURL(
		state: string,
		codeVerifier: string,
		scopes: string[] = this.defaultScopes,
	): URL {
		const requestedScopes = scopes || this.defaultScopes;
		return this.client.createAuthorizationURL(
			state,
			codeVerifier,
			requestedScopes,
		);
	}

	async getUserProfile(
		code: string,
		codeVerifier: string,
	): Promise<{ profile: OAuthProfile; tokens: OAuthTokens }> {
		try {
			const tokens: any = await this.client.validateAuthorizationCode(
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

			const googleUser = (await googleUserResponse.json()) as {
				id: string;
				email: string;
				name: string;
				picture?: string;
				verified_email?: boolean;
			};

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
					accessToken: tokens.data?.access_token ?? tokens.accessToken(),
					refreshToken: tokens.data?.refresh_token ?? tokens.refreshToken?.() ?? null,
					scope: tokens.data?.scope ?? tokens.scope ?? null,
					accessTokenExpiresAt: new Date(
						Date.now() + (tokens.data?.expires_in ?? tokens.expiresIn ?? 0) * 1000,
					).toISOString(),
				},
			};
		} catch (error) {
			console.error("Error in GoogleProvider.getUserProfile:", error);
			throw error;
		}
	}

	async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
		const newTokens: any = await this.client.refreshAccessToken(refreshToken);

		return {
			accessToken: newTokens.accessToken?.() ?? newTokens.accessToken,
			refreshToken: newTokens.refreshToken?.() ?? newTokens.refreshToken ?? null,
			scope: newTokens.scope ?? newTokens.scopes ?? null,
			accessTokenExpiresAt: new Date(
				Date.now() + (newTokens.expiresIn ?? newTokens.expires_in ?? 0) * 1000,
			).toISOString(),
		};
	}
}
