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

	private getAccessToken(tokens: {
		accessToken?: string | (() => string) | undefined;
		data?: { access_token?: string | undefined } | undefined;
	}): string {
		if (tokens.data?.access_token) return tokens.data.access_token;
		if (typeof tokens.accessToken === "function") return tokens.accessToken();
		return tokens.accessToken ?? "";
	}

	private getRefreshToken(tokens: {
		refreshToken?: string | (() => string) | undefined;
		hasRefreshToken?: (() => boolean) | undefined;
		data?: { refresh_token?: string | undefined } | undefined;
	}): string | null {
		if (tokens.data?.refresh_token) return tokens.data.refresh_token;
		if (typeof tokens.hasRefreshToken === "function" && !tokens.hasRefreshToken()) return null;
		if (typeof tokens.refreshToken === "function") return tokens.refreshToken();
		return tokens.refreshToken ?? null;
	}

	private getScopes(tokens: {
		scope?: string | null | undefined;
		scopes?: string | (() => string[]) | null | undefined;
		hasScopes?: (() => boolean) | undefined;
		data?: { scope?: string | undefined } | undefined;
	}): string | null {
		if (tokens.data?.scope) return tokens.data.scope;
		if (typeof tokens.hasScopes === "function" && tokens.hasScopes()) {
			if ("scopes" in tokens && typeof tokens.scopes === "function") {
				return tokens.scopes().join(" ");
			}
		}
		if (typeof tokens.scopes === "string") return tokens.scopes;
		return tokens.scope ?? null;
	}

	private getAccessTokenExpiresAt(tokens: {
		expiresIn?: number | undefined;
		expires_in?: number | undefined;
		accessTokenExpiresAt?: (() => Date) | undefined;
		data?: { expires_in?: number | undefined } | undefined;
	}): string {
		if (typeof tokens.accessTokenExpiresAt === "function") {
			return tokens.accessTokenExpiresAt().toISOString();
		}
		const expiresIn = tokens.data?.expires_in ?? tokens.expiresIn ?? tokens.expires_in ?? 0;
		return new Date(Date.now() + expiresIn * 1000).toISOString();
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
							Authorization: `Bearer ${this.getAccessToken(tokens)}`,
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
						accessToken: this.getAccessToken(tokens),
						refreshToken: this.getRefreshToken(tokens),
						scope: this.getScopes(tokens),
						accessTokenExpiresAt: this.getAccessTokenExpiresAt(tokens),
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
			scopes?: string | (() => string[]) | undefined;
			hasScopes?: (() => boolean) | undefined;
			hasRefreshToken?: (() => boolean) | undefined;
			accessTokenExpiresAt?: (() => Date) | undefined;
			expiresIn?: number | undefined;
			expires_in?: number | undefined;
			data?: {
				access_token?: string | undefined;
				refresh_token?: string | undefined;
				scope?: string | undefined;
				expires_in?: number | undefined;
			} | undefined;
		};

		const newTokens = (await this.client.refreshAccessToken(
			refreshToken,
		)) as unknown as GoogleRefreshResponse;

		return {
			accessToken: this.getAccessToken(newTokens),
			refreshToken: this.getRefreshToken(newTokens),
			scope: this.getScopes(newTokens),
			accessTokenExpiresAt: this.getAccessTokenExpiresAt(newTokens),
		};
	}
}
