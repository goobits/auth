import { OAuthProvider } from "./base.js";
import { Apple } from "arctic";
import { decodeBase64IgnorePadding } from "@oslojs/encoding";
import type { OAuthProfile, OAuthTokens } from "../types/index.js";
import { getLogger } from "../utils/logger.js";

type AppleProviderConfig = {
	clientId: string;
	teamId: string;
	keyId: string;
	privateKey: string;
	callbackUrl: string;
};

/**
 * Apple OAuth Provider
 * Implements Sign in with Apple
 */
export class AppleProvider extends OAuthProvider {
	private client: Apple;

	private readTokenValue(value?: string | (() => string) | null): string | null {
		if (typeof value === "function") return value();
		return value ?? null;
	}

	/**
	 * @param {Object} config - Configuration
	 * @param {string} config.clientId - Apple Services ID
	 * @param {string} config.teamId - Apple Team ID
	 * @param {string} config.keyId - Apple Key ID
	 * @param {string} config.privateKey - Apple Private Key (base64 encoded)
	 * @param {string} config.callbackUrl - OAuth callback URL
	 */
	constructor(config: AppleProviderConfig) {
		super("apple", config);

		if (
			!config.clientId ||
			!config.teamId ||
			!config.keyId ||
			!config.privateKey ||
			!config.callbackUrl
		) {
			throw new Error(
				"AppleProvider requires clientId, teamId, keyId, privateKey, and callbackUrl",
			);
		}

		// Decode the private key
		const privateKeyBytes = this._decodePrivateKey(config.privateKey);

		this.client = new Apple(
			config.clientId,
			config.teamId,
			config.keyId,
			privateKeyBytes,
			config.callbackUrl,
		);
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
				.replace("-----BEGIN PRIVATE KEY-----", "")
				.replace("-----END PRIVATE KEY-----", "")
				.replaceAll("\r", "")
				.replaceAll("\n", "")
				.trim();

			return decodeBase64IgnorePadding(cleaned);
		} catch (error) {
			getLogger().error?.("Error decoding Apple private key:", error);
			throw new Error("Invalid Apple private key format");
		}
	}

	createAuthorizationURL(
		state: string,
		codeVerifier: string,
		scopes: string[] = ["name", "email"],
	): URL {
		// Apple uses name and email scopes
		const requestedScopes = scopes || ["name", "email"];
		const client = this.client as unknown as {
			createAuthorizationURL: (...args: unknown[]) => URL;
		};
		const createAuthorizationURL = client.createAuthorizationURL;
		if (createAuthorizationURL.length >= 3) {
			return createAuthorizationURL.call(
				this.client,
				state,
				codeVerifier,
				requestedScopes,
			);
		}
		return createAuthorizationURL.call(this.client, state, requestedScopes);
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
		userData: string | null = null,
	): Promise<{ profile: OAuthProfile; tokens: OAuthTokens }> {
		try {
			type AppleTokenResponse = {
				idToken: () => { email?: string; sub?: string };
				accessToken?: string | (() => string);
				refreshToken?: string | (() => string);
				scope?: string;
				scopes?: string;
				expiresIn?: number;
				expires_in?: number;
			};

			const client = this.client as unknown as {
				validateAuthorizationCode: (...args: unknown[]) => Promise<AppleTokenResponse>;
			};

			const validateAuthorizationCode = client.validateAuthorizationCode;
			const tokens =
				validateAuthorizationCode.length >= 2
					? await validateAuthorizationCode.call(
							this.client,
							code,
							codeVerifier,
						)
					: await validateAuthorizationCode.call(this.client, code);

			const { email, sub: appleUserId } = tokens.idToken();

			if (!email || !appleUserId) {
				throw new Error("Invalid token data from Apple");
			}

			let name = undefined;

			// Handle first-time sign in data if present
			if (userData) {
				try {
					const userJson = JSON.parse(userData);
					if (userJson.name) {
						const firstName = userJson.name.firstName || "";
						const lastName = userJson.name.lastName || "";
						const fullName = `${firstName} ${lastName}`.trim();
						if (fullName) name = fullName;
					}
				} catch (e) {
					getLogger().warn?.("Could not parse Apple user data:", e);
				}
			}

			return {
				profile: {
					id: appleUserId,
					email: email as string,
					...(name && { name }),
					verified_email: true, // Apple emails are always verified
				},
				tokens: {
					accessToken: this.readTokenValue(tokens.accessToken) ?? "",
					refreshToken: this.readTokenValue(tokens.refreshToken),
					scope: tokens.scope ?? tokens.scopes ?? null,
					accessTokenExpiresAt: new Date(
						Date.now() + (tokens.expiresIn ?? tokens.expires_in ?? 0) * 1000,
					).toISOString(),
				},
			};
		} catch (error) {
			getLogger().error?.("Error in AppleProvider.getUserProfile:", error);
			throw error;
		}
	}

	async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
		type AppleRefreshResponse = {
			accessToken?: string | (() => string);
			refreshToken?: string | (() => string);
			scope?: string;
			scopes?: string;
			expiresIn?: number;
				expires_in?: number;
			};

		const client = this.client as unknown as {
			refreshAccessToken: (token: string) => Promise<AppleRefreshResponse>;
		};

		const newTokens = await client.refreshAccessToken(refreshToken);

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
