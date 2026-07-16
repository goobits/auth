import type { Cookies } from '@sveltejs/kit'

import type { OAuthTokens } from '../../types/index.ts'
import type { OAuthTokenCodec, OAuthTokenEncryptionOptions } from './OAuthTokenCodec.ts'
import { resolveOAuthTokenCodec } from './_tokenEncryption.ts'
import { openOAuthTokens, serializeOAuthTokens } from './_tokenPayload.ts'
import { TokenAdapter } from './TokenAdapter.ts'

/**
 * Cookie-based Token Adapter
 * Stores encrypted OAuth tokens in cookies (for stateless apps)
 */
export class CookieTokenAdapter extends TokenAdapter {
	private cookieName: string
	private readonly tokenCodec: OAuthTokenCodec
	private secureCookies: boolean
	private maxAge: number
	private _cookies: Cookies | null

	/**
	 * @param {Object} options - Configuration options
	 * @param {string} options.cookieName - Cookie name for storing tokens
	 * @param {string} options.encryptionKeyringJson - Rotation-ready AES-GCM keyring JSON
	 * @param {boolean} [options.secureCookies=true] - Use secure cookies
	 * @param {number} [options.maxAge=604800] - Cookie max age in seconds (default: 7 days)
	 */
	constructor(
		options: OAuthTokenEncryptionOptions & {
			cookieName?: string
			secureCookies?: boolean
			maxAge?: number
		} = {}
	) {
		super()
		this.cookieName = options.cookieName || 'oauth_tokens'
		const tokenCodec = resolveOAuthTokenCodec(options, 'CookieTokenAdapter')
		if (!tokenCodec) throw new Error('CookieTokenAdapter cannot disable token encryption')
		this.tokenCodec = tokenCodec
		this.secureCookies = options.secureCookies !== false
		this.maxAge = options.maxAge || 60 * 60 * 24 * 7 // 7 days
		// Store for provider-specific cookies
		this._cookies = null
	}

	/**
	 * Set the cookies object for this adapter
	 *
	 * @param {import('@sveltejs/kit').Cookies} cookies - Cookies to set.
	 */
	_setCookies(cookies: Cookies) {
		this._cookies = cookies
	}

	private setTokenCookie(provider: string, value: string): void {
		if (!this._cookies) {
			throw new Error('Cookies not set. Call _setCookies() first.')
		}
		const cookieName = `${this.cookieName}_${provider}`
		this._cookies.set(cookieName, value, {
			httpOnly: true,
			secure: this.secureCookies,
			sameSite: 'strict',
			path: '/',
			maxAge: this.maxAge
		})
	}

	async storeTokens(userId: string, provider: string, tokens: OAuthTokens) {
		const encryptedTokens = await serializeOAuthTokens(tokens, this.tokenCodec, {
			userId,
			provider
		})
		this.setTokenCookie(provider, encryptedTokens)
	}

	async getTokens(userId: string, provider: string): Promise<OAuthTokens | null> {
		if (!this._cookies) {
			throw new Error('Cookies not set. Call _setCookies() first.')
		}

		const cookieName = `${this.cookieName}_${provider}`
		const encryptedTokens = this._cookies.get(cookieName)

		if (!encryptedTokens) return null

		return openOAuthTokens({
			value: encryptedTokens,
			codec: this.tokenCodec,
			context: { userId, provider },
			reseal: async (ciphertext) => this.setTokenCookie(provider, ciphertext)
		})
	}

	async refreshTokens(
		_userId: string,
		_provider: string
	): Promise<import('../../types/index.ts').OAuthTokens | null> {
		throw new Error('refreshTokens not implemented - use provider-specific refresh logic')
	}

	async deleteTokens(_userId: string, provider: string) {
		if (!this._cookies) {
			throw new Error('Cookies not set. Call _setCookies() first.')
		}

		const cookieName = `${this.cookieName}_${provider}`
		this._cookies.delete(cookieName, { path: '/' })
	}
}
