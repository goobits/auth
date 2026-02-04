import { OAuthProvider } from "./base.ts";
import { Apple } from "arctic";
import { decodeBase64IgnorePadding } from "@oslojs/encoding";
import type { OAuthProfile, OAuthTokens } from "../types/index.ts";

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
			console.error("Error decoding Apple private key:", error);
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
		const createAuthorizationURL = (this.client as any).createAuthorizationURL;
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
		const validateAuthorizationCode = (this.client as any)
			.validateAuthorizationCode;
		const tokens: any =
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
					console.warn("Could not parse Apple user data:", e);
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
					accessToken: tokens.accessToken?.() ?? tokens.accessToken,
					refreshToken: tokens.refreshToken?.() ?? tokens.refreshToken ?? null,
					scope: tokens.scope ?? tokens.scopes ?? null,
					accessTokenExpiresAt: new Date(
						Date.now() + (tokens.expiresIn ?? tokens.expires_in ?? 0) * 1000,
					).toISOString(),
				},
			};
		} catch (error) {
			console.error("Error in AppleProvider.getUserProfile:", error);
			throw error;
		}
	}

	async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
		const newTokens: any = await (this.client as any).refreshAccessToken(refreshToken);

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
