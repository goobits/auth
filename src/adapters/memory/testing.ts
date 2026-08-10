import type { Cookies } from '@sveltejs/kit'
import type { OAuthTokens, AuthSession, User } from '../../types/index.ts'
import { TokenAdapter } from '../oauth-token/TokenAdapter.ts'
import { MemorySessionAdapter } from './session.ts'
import { MemoryUserAdapter } from './user.ts'

/** Test session adapter with no-op cookie writes. */
export class MockSessionAdapter extends MemorySessionAdapter {
	#users: MemoryUserAdapter

	constructor() {
		const users = new MemoryUserAdapter()
		super({
			cookieName: 'session',
			secureCookies: false,
			users
		})
		this.#users = users
	}

	setUser(user: User): void {
		this.#users.setUser(user)
	}

	setSessionCookie(_cookies: Cookies, _session: AuthSession): void {}
	deleteSessionCookie(_cookies: Cookies): void {}
}

/** Test OAuth token adapter backed by an in-memory map. */
export class MockTokenAdapter extends TokenAdapter {
	#tokens = new Map<string, OAuthTokens>()

	async storeTokens(userId: string, provider: string, tokens: OAuthTokens): Promise<void> {
		this.#tokens.set(`${userId}:${provider}`, tokens)
	}

	async getTokens(userId: string, provider: string): Promise<OAuthTokens | null> {
		return this.#tokens.get(`${userId}:${provider}`) ?? null
	}

	async refreshTokens(userId: string, provider: string): Promise<OAuthTokens | null> {
		return this.getTokens(userId, provider)
	}

	async deleteTokens(userId: string, provider: string): Promise<void> {
		this.#tokens.delete(`${userId}:${provider}`)
	}
}
