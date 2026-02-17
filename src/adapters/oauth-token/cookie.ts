import { TokenAdapter } from "./base.js";
import { encryptTokens, decryptTokens } from "../../utils/crypto.js";
import type { Cookies } from "@sveltejs/kit";
import type { OAuthTokens } from "../../types/index.js";

/**
 * Cookie-based Token Adapter
 * Stores encrypted OAuth tokens in cookies (for stateless apps)
 */
export class CookieTokenAdapter extends TokenAdapter {
	private cookieName: string;
	private encryptionKey: string;
	private secureCookies: boolean;
	private maxAge: number;
	private _cookies: Cookies | null;
	/**
	 * @param {Object} options - Configuration options
	 * @param {string} options.cookieName - Cookie name for storing tokens
	 * @param {string} options.encryptionKey - 32-byte hex encryption key
	 * @param {boolean} [options.secureCookies=true] - Use secure cookies
	 * @param {number} [options.maxAge=604800] - Cookie max age in seconds (default: 7 days)
	 */
	constructor(
		options: {
			cookieName?: string;
			encryptionKey?: string;
			secureCookies?: boolean;
			maxAge?: number;
		} = {},
	) {
		super();
		this.cookieName = options.cookieName || "oauth_tokens";
		this.encryptionKey = options.encryptionKey || "";
		this.secureCookies = options.secureCookies !== false;
		this.maxAge = options.maxAge || 60 * 60 * 24 * 7; // 7 days

		if (!this.encryptionKey) {
			throw new Error("CookieTokenAdapter requires encryptionKey option");
		}

		// Store for provider-specific cookies
		this._cookies = null;
	}

	/**
	 * Set the cookies object for this adapter
	 * @param {import('@sveltejs/kit').Cookies} cookies
	 */
	_setCookies(cookies: Cookies) {
		this._cookies = cookies;
	}

	async storeTokens(userId: string, provider: string, tokens: Record<string, unknown>) {
		if (!this._cookies) {
			throw new Error("Cookies not set. Call _setCookies() first.");
		}

		const encryptedTokens = await encryptTokens(tokens, this.encryptionKey);
		const cookieName = `${this.cookieName}_${provider}`;

		this._cookies.set(cookieName, encryptedTokens, {
			httpOnly: true,
			secure: this.secureCookies,
			sameSite: "strict",
			path: "/",
			maxAge: this.maxAge,
		});
	}

	async getTokens(userId: string, provider: string): Promise<OAuthTokens | null> {
		if (!this._cookies) {
			throw new Error("Cookies not set. Call _setCookies() first.");
		}

		const cookieName = `${this.cookieName}_${provider}`;
		const encryptedTokens = this._cookies.get(cookieName);

		if (!encryptedTokens) return null;

		return (await decryptTokens(encryptedTokens, this.encryptionKey)) as OAuthTokens;
	}

	async refreshTokens(
		userId: string,
		provider: string,
	): Promise<import("../../types/index.js").OAuthTokens | null> {
		throw new Error(
			"refreshTokens not implemented - use provider-specific refresh logic",
		);
	}

	async deleteTokens(userId: string, provider: string) {
		if (!this._cookies) {
			throw new Error("Cookies not set. Call _setCookies() first.");
		}

		const cookieName = `${this.cookieName}_${provider}`;
		this._cookies.delete(cookieName, { path: "/" });
	}
}
