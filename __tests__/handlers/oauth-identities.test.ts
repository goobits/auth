import { describe, expect, it, vi } from 'vitest'

import {
	createOAuthIdentityListHandler,
	createOAuthIdentityUnlinkHandler
} from '../../src/handlers/oauthIdentities.ts'
import type { OAuthTokens } from '../../src/types/index.ts'
import { createRequestEvent } from '../testKit.ts'

const tokens: OAuthTokens = {
	accessToken: 'access-token',
	refreshToken: 'refresh-token',
	scope: 'openid',
	accessTokenExpiresAt: '2099-01-01T00:00:00.000Z'
}

function authenticatedEvent(provider = 'google') {
	return createRequestEvent({
		method: 'POST',
		form: { provider },
		locals: {
			user: {
				id: 'user-1',
				email: 'member@example.com',
				name: 'Member',
				avatar: null,
				emailVerified: true
			},
			session: {
				id: 'session-1',
				userId: 'user-1',
				expiresAt: new Date('2099-01-01T00:00:00.000Z')
			}
		}
	})
}

describe('OAuth identity management handlers', () => {
	it('lists only connected provider names and never exposes stable subjects', async () => {
		const handler = createOAuthIdentityListHandler({
			identityAdapter: {
				getIdentity: vi.fn(),
				linkIdentity: vi.fn(),
				unlinkIdentity: vi.fn(),
				listIdentities: vi.fn(async () => [
					{ userId: 'user-1', provider: 'google', subject: 'google-secret-subject' },
					{ userId: 'user-1', provider: 'apple', subject: 'apple-secret-subject' }
				])
			}
		})

		const response = await handler(authenticatedEvent())
		const body = await response.text()

		expect(JSON.parse(body)).toEqual({ ok: true, providers: ['apple', 'google'] })
		expect(body).not.toContain('secret-subject')
	})

	it('authorizes with an unread request clone before revoking and unlinking', async () => {
		const order: string[] = []
		const unlinkIdentity = vi.fn(async () => {
			order.push('unlink')
		})
		const deleteTokens = vi.fn(async () => {
			order.push('delete-tokens')
		})
		const authorizeIdentityChange = vi.fn(async ({ request }: { request: Request }) => {
			expect((await request.formData()).get('provider')).toBe('google')
			order.push('authorize')
			return true
		})
		const handler = createOAuthIdentityUnlinkHandler({
			identityAdapter: {
				getIdentity: vi.fn(),
				linkIdentity: vi.fn(),
				listIdentities: vi.fn(async () => [
					{ userId: 'user-1', provider: 'google', subject: 'google-subject' }
				]),
				unlinkIdentity
			},
			providers: {
				google: {
					revokeTokens: vi.fn(async () => {
						order.push('revoke')
					})
				} as never
			},
			authorizeIdentityChange,
			tokenAdapter: {
				getTokens: vi.fn(async () => tokens),
				storeTokens: vi.fn(),
				refreshTokens: vi.fn(),
				deleteTokens
			},
			hooks: {
				onUnlinked: vi.fn(async () => {
					order.push('hook')
				})
			}
		})

		const response = await handler(authenticatedEvent())

		expect(await response.json()).toEqual({ ok: true })
		expect(order).toEqual(['authorize', 'revoke', 'delete-tokens', 'unlink', 'hook'])
		expect(unlinkIdentity).toHaveBeenCalledWith('user-1', 'google')
	})

	it('keeps local tokens and identity linked when provider revocation fails', async () => {
		const unlinkIdentity = vi.fn()
		const deleteTokens = vi.fn()
		const handler = createOAuthIdentityUnlinkHandler({
			identityAdapter: {
				getIdentity: vi.fn(),
				linkIdentity: vi.fn(),
				listIdentities: vi.fn(async () => [
					{ userId: 'user-1', provider: 'google', subject: 'google-subject' }
				]),
				unlinkIdentity
			},
			providers: {
				google: {
					revokeTokens: vi.fn(async () => {
						throw new Error('provider unavailable')
					})
				} as never
			},
			authorizeIdentityChange: async () => true,
			tokenAdapter: {
				getTokens: vi.fn(async () => tokens),
				storeTokens: vi.fn(),
				refreshTokens: vi.fn(),
				deleteTokens
			}
		})

		await expect(handler(authenticatedEvent())).rejects.toThrow('provider unavailable')
		expect(deleteTokens).not.toHaveBeenCalled()
		expect(unlinkIdentity).not.toHaveBeenCalled()
	})
})
