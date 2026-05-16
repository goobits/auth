import { OAuthProvider } from "./base.js";
import { Google } from "arctic";
import type { OAuthProfile, OAuthTokens } from "../types/index.js";
import { getLogger } from "../utils/logger.js";

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

	private readTokenValue(value?: string | (() => string) | null): string | null {
		if (typeof value === "function") return value();
		return value ?? null;
	}

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
			type GoogleTokenResponse = {
				accessToken: string | (() => string);
				refreshToken?: string | (() => string);
				scope?: string;
				expiresIn?: number;
				data?: {
					access_token?: string;
					refresh_token?: string;
					scope?: string;
					expires_in?: number;
				};
			};

			const tokens = (await this.client.validateAuthorizationCode(
				code,
				codeVerifier,
			)) as GoogleTokenResponse;

			const googleUserResponse = await fetch(
				"https://www.googleapis.com/oauth2/v1/userinfo?alt=json",
				{
						headers: {
							Authorization: `Bearer ${this.readTokenValue(tokens.accessToken) ?? ""}`,
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

			const profile: {
				id: string;
				email: string;
				name: string;
				picture?: string;
				verified_email: true;
			} = {
				id: googleUser.id,
				email: googleUser.email,
				name: googleUser.name,
				verified_email: googleUser.verified_email,
			};
			if (googleUser.picture) {
				profile.picture = googleUser.picture;
			}
			return {
				profile,
					tokens: {
						accessToken:
							tokens.data?.access_token ??
							this.readTokenValue(tokens.accessToken) ??
							"",
						refreshToken:
							tokens.data?.refresh_token ??
							this.readTokenValue(tokens.refreshToken),
						scope: tokens.data?.scope ?? tokens.scope ?? null,
						accessTokenExpiresAt: new Date(
							Date.now() + (tokens.data?.expires_in ?? tokens.expiresIn ?? 0) * 1000,
					).toISOString(),
				},
			};
		} catch (error) {
			getLogger().error?.("Error in GoogleProvider.getUserProfile:", error);
			throw error;
		}
	}

	async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
		type GoogleRefreshResponse = {
			accessToken?: string | (() => string);
			refreshToken?: string | (() => string);
			scope?: string;
			scopes?: string;
			expiresIn?: number;
			expires_in?: number;
		};

		const newTokens = (await this.client.refreshAccessToken(
			refreshToken,
		)) as unknown as GoogleRefreshResponse;

		return {
			accessToken: this.readTokenValue(newTokens.accessToken) ?? "",
			refreshToken: this.readTokenValue(newTokens.refreshToken),
			scope: newTokens.scope ?? newTokens.scopes ?? null,
			accessTokenExpiresAt: new Date(
				Date.now() + (newTokens.expiresIn ?? newTokens.expires_in ?? 0) * 1000,
			).toISOString(),
		};
	}
}
