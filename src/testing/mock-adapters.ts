import type { Cookies } from '@sveltejs/kit'

import { MemorySessionAdapter, MemoryUserAdapter } from '../adapters/memory/index.js'
import { TokenAdapter } from '../adapters/oauth-token/base.js'
import type { OAuthTokens, Session, User } from '../types/index.js'

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

	setSessionCookie(_cookies: Cookies, _session: Session): void {}
	deleteSessionCookie(_cookies: Cookies): void {}
}

export class MockUserAdapter extends MemoryUserAdapter {}

export class MockTokenAdapter extends TokenAdapter {
	private tokens = new Map<string, OAuthTokens>()

	async storeTokens(userId: string, provider: string, tokens: OAuthTokens): Promise<void> {
		this.tokens.set(`${ userId }:${ provider }`, tokens)
	}

	async getTokens(userId: string, provider: string): Promise<OAuthTokens | null> {
		return this.tokens.get(`${ userId }:${ provider }`) ?? null
	}

	async refreshTokens(userId: string, provider: string): Promise<OAuthTokens | null> {
		return this.getTokens(userId, provider)
	}

	async deleteTokens(userId: string, provider: string): Promise<void> {
		this.tokens.delete(`${ userId }:${ provider }`)
	}
}
