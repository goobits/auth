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

type AppleIdTokenPayload = {
	iss?: string;
	aud?: string | string[];
	exp?: number;
	email?: string;
	sub?: string;
};

type AppleTokenResponse = {
	idToken: string | (() => string) | (() => { email?: string; sub?: string });
	accessToken?: string | (() => string);
	refreshToken?: string | (() => string);
	scope?: string;
	scopes?: string;
	expiresIn?: number;
	expires_in?: number;
};

const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys";
let cachedAppleJwks: { keys: JsonWebKey[]; expiresAt: number } | null = null;

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

			const { email, sub: appleUserId } = await this.verifyIdToken(tokens);

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
					verified_email: true,
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

	private async verifyIdToken(tokens: AppleTokenResponse): Promise<AppleIdTokenPayload> {
		const rawIdToken = typeof tokens.idToken === "function" ? tokens.idToken() : tokens.idToken;
		if (rawIdToken && typeof rawIdToken === "object") return rawIdToken as AppleIdTokenPayload;
		const idTokenValue = typeof rawIdToken === "string" ? rawIdToken : "";

		if (!idTokenValue) {
			throw new Error("Missing Apple ID token");
		}

		const [headerPart, payloadPart, signaturePart] = idTokenValue.split(".");
		if (!headerPart || !payloadPart || !signaturePart) {
			throw new Error("Invalid Apple ID token format");
		}

		const header = parseJwtPart(headerPart) as { alg?: string; kid?: string };
		if (header.alg !== "RS256" || !header.kid) {
			throw new Error("Unsupported Apple ID token header");
		}

		const jwks = await getAppleJwks();
		const jwk = jwks.keys.find((key) => (key as JsonWebKey & { kid?: string }).kid === header.kid);
		if (!jwk) {
			throw new Error("Apple ID token key not found");
		}

		const key = await crypto.subtle.importKey(
			"jwk",
			jwk,
			{ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
			false,
			["verify"],
		);
		const signingInput = new TextEncoder().encode(`${headerPart}.${payloadPart}`);
		const signature = base64UrlToBytes(signaturePart);
		const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, signingInput);
		if (!valid) {
			throw new Error("Invalid Apple ID token signature");
		}

		const payload = parseJwtPart(payloadPart) as AppleIdTokenPayload;
		const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
		const nowSeconds = Math.floor(Date.now() / 1000);
		if (payload.iss !== APPLE_ISSUER) {
			throw new Error("Invalid Apple ID token issuer");
		}
		if (!audience.includes(String(this.config["clientId"] || ""))) {
			throw new Error("Invalid Apple ID token audience");
		}
		if (!payload.exp || payload.exp <= nowSeconds) {
			throw new Error("Expired Apple ID token");
		}
		return payload;
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

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
	const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
	const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
	const binary = atob(padded);
	const bytes = new Uint8Array(new ArrayBuffer(binary.length));
	for (let i = 0; i < binary.length; i += 1) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

function parseJwtPart(value: string): unknown {
	const bytes = base64UrlToBytes(value);
	return JSON.parse(new TextDecoder().decode(bytes));
}

async function getAppleJwks(): Promise<{ keys: JsonWebKey[] }> {
	const now = Date.now();
	if (cachedAppleJwks && cachedAppleJwks.expiresAt > now) {
		return { keys: cachedAppleJwks.keys };
	}
	const response = await fetch(APPLE_JWKS_URL);
	if (!response.ok) {
		throw new Error(`Apple JWKS fetch failed (${response.status})`);
	}
	const body = (await response.json()) as { keys?: JsonWebKey[] };
	const keys = Array.isArray(body.keys) ? body.keys : [];
	cachedAppleJwks = { keys, expiresAt: now + 60 * 60 * 1000 };
	return { keys };
}
