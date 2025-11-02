import { OAuthProvider } from "./base.js";
import { Apple } from "arctic";
import { decodeBase64IgnorePadding } from "@oslojs/encoding";

/**
 * Apple OAuth Provider
 * Implements Sign in with Apple
 */
export class AppleProvider extends OAuthProvider {
	/**
	 * @param {Object} config - Configuration
	 * @param {string} config.clientId - Apple Services ID
	 * @param {string} config.teamId - Apple Team ID
	 * @param {string} config.keyId - Apple Key ID
	 * @param {string} config.privateKey - Apple Private Key (base64 encoded)
	 * @param {string} config.callbackUrl - OAuth callback URL
	 */
	constructor(config) {
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
	_decodePrivateKey(privateKey) {
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

	createAuthorizationURL(state, codeVerifier, scopes) {
		// Apple uses name and email scopes
		const requestedScopes = scopes || ["name", "email"];
		return this.client.createAuthorizationURL(
			state,
			codeVerifier,
			requestedScopes,
		);
	}

	/**
	 * Get user profile from Apple
	 * @param {string} code - Authorization code
	 * @param {string} codeVerifier - PKCE code verifier
	 * @param {string} [userData] - Optional user data from first-time sign in (JSON string)
	 * @returns {Promise<{profile: Object, tokens: Object}>}
	 */
	async getUserProfile(code, codeVerifier, userData = null) {
		try {
			const tokens = await this.client.validateAuthorizationCode(
				code,
				codeVerifier,
			);

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
					email,
					...(name && { name }),
					verified_email: true, // Apple emails are always verified
				},
				tokens: {
					accessToken: tokens.accessToken(),
					refreshToken: tokens.refreshToken(),
					scope: tokens.scope,
					accessTokenExpiresAt: new Date(
						Date.now() + tokens.expiresIn * 1000,
					).toISOString(),
				},
			};
		} catch (error) {
			console.error("Error in AppleProvider.getUserProfile:", error);
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
