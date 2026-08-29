import { describe, expect, it } from 'vitest'
import { MockTokenAdapter } from '../../src/adapters/memory/testing.ts'
import { CookieTokenAdapter } from '../../src/adapters/oauth-token/CookieTokenAdapter.ts'
import { D1TokenAdapter } from '../../src/adapters/oauth-token/D1TokenAdapter.ts'
import { DrizzleTokenAdapter } from '../../src/adapters/oauth-token/DrizzleTokenAdapter.ts'
import { KVTokenAdapter } from '../../src/adapters/oauth-token/KVTokenAdapter.ts'
import { TokenAdapter } from '../../src/adapters/oauth-token/TokenAdapter.ts'

describe('TokenAdapter refresh ownership', () => {
	it.each([
		['CookieTokenAdapter', CookieTokenAdapter],
		['D1TokenAdapter', D1TokenAdapter],
		['DrizzleTokenAdapter', DrizzleTokenAdapter],
		['KVTokenAdapter', KVTokenAdapter],
		['MockTokenAdapter', MockTokenAdapter]
	])('%s inherits the compatibility behavior', (_name, Adapter) => {
		expect(Adapter.prototype.refreshTokens).toBe(TokenAdapter.prototype.refreshTokens)
	})

	it('fails fast and directs refresh through the provider capability', async () => {
		await expect(
			TokenAdapter.prototype.refreshTokens.call({} as TokenAdapter, 'user-1', 'google')
		).rejects.toThrow(/OAuthProvider\.refreshAccessToken/)
	})
})
