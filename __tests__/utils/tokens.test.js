import { describe, it, expect, vi } from 'vitest'
import { createVerificationToken, consumeVerificationToken, getUserForVerificationToken, VERIFICATION_TOKEN_TYPES } from '../../src/utils/tokens.js'

function createAdapter() {
	const tokens = new Map()
	return {
		deleteByUserAndType: vi.fn(async ({ userId, type }) => {
			for (const [key, value] of tokens.entries()) {
				if (value.userId === userId && value.type === type) tokens.delete(key)
			}
		}),
		create: vi.fn(async ({ userId, type, token, expiresAt }) => {
			tokens.set(token, { id: token, userId, type, expiresAt })
		}),
		findByToken: vi.fn(async ({ token, type }) => {
			const record = tokens.get(token)
			if (!record || record.type !== type) return null
			return { token: record, user: { id: record.userId, password: 'secret' } }
		}),
		deleteById: vi.fn(async (tokenId) => tokens.delete(tokenId)),
		_tokens: tokens
	}
}

describe('verification tokens', () => {
	it('replaces existing tokens of the same type', async () => {
		const adapter = createAdapter()
		const token = await createVerificationToken({
			adapter,
			userId: 'u1',
			type: VERIFICATION_TOKEN_TYPES.EMAIL_VERIFICATION
		})
		expect(adapter.deleteByUserAndType).toHaveBeenCalled()
		expect(adapter._tokens.has(token)).toBe(true)
	})

	it('consumes and deletes token', async () => {
		const adapter = createAdapter()
		const expiresAt = new Date(Date.now() + 10000)
		await adapter.create({ userId: 'u1', type: VERIFICATION_TOKEN_TYPES.PASSWORD_RESET, token: 't1', expiresAt })
		const user = await consumeVerificationToken({ adapter, token: 't1', type: VERIFICATION_TOKEN_TYPES.PASSWORD_RESET })
		expect(user.id).toBe('u1')
		expect(adapter._tokens.has('t1')).toBe(false)
	})

	it('returns null for expired tokens', async () => {
		const adapter = createAdapter()
		await adapter.create({ userId: 'u1', type: VERIFICATION_TOKEN_TYPES.PASSWORD_RESET, token: 't2', expiresAt: new Date(Date.now() - 1000) })
		const user = await consumeVerificationToken({ adapter, token: 't2', type: VERIFICATION_TOKEN_TYPES.PASSWORD_RESET })
		expect(user).toBeNull()
	})

	it('getUserForVerificationToken respects expiry and sanitize', async () => {
		const adapter = createAdapter()
		await adapter.create({ userId: 'u1', type: VERIFICATION_TOKEN_TYPES.EMAIL_UPDATE, token: 't3', expiresAt: new Date(Date.now() + 1000) })
		const user = await getUserForVerificationToken({
			adapter,
			token: 't3',
			type: VERIFICATION_TOKEN_TYPES.EMAIL_UPDATE,
			sanitizeUser: (u) => ({ id: u.id })
		})
		expect(user).toEqual({ id: 'u1' })
	})
})
