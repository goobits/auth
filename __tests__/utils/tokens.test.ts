import { describe, it, expect, vi } from 'vitest'
import { createVerificationToken, consumeVerificationToken, getUserForVerificationToken, VERIFICATION_TOKEN_TYPES } from '../../src/utils/tokens.ts'
import { sha256Hex } from '../../src/utils/crypto.ts'

type TokenRecord = {
	id: string;
	token: string;
	userId: string;
	type: string;
	expiresAt: Date;
}

function createAdapter() {
	const tokens = new Map<
		string,
		TokenRecord
	>()
	return {
		deleteByUserAndType: vi.fn(async ({ userId, type }: { userId: string; type: string }) => {
			for (const [key, value] of tokens.entries()) {
				if (value.userId === userId && value.type === type) tokens.delete(key)
			}
		}),
		create: vi.fn(async ({ userId, type, token, expiresAt }: Omit<TokenRecord, 'id'>) => {
			tokens.set(token, { id: token, token, userId, type, expiresAt })
		}),
		findByToken: vi.fn(async ({ token, type }: { token: string; type: string }) => {
			const record = tokens.get(token)
			if (!record || record.type !== type) return null
			return { token: record, user: { id: record.userId, password: 'secret' } }
		}),
		deleteById: vi.fn(async (tokenId: string) => {
			tokens.delete(tokenId)
		}),
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
		const tokenHash = await sha256Hex(token)
		expect(adapter.deleteByUserAndType).toHaveBeenCalled()
		expect(adapter._tokens.has(tokenHash)).toBe(true)
	})

	it('consumes and deletes token', async () => {
		const adapter = createAdapter()
		const expiresAt = new Date(Date.now() + 10000)
		const token = 't1'
		const tokenHash = await sha256Hex(token)
		await adapter.create({ userId: 'u1', type: VERIFICATION_TOKEN_TYPES.PASSWORD_RESET, token: tokenHash, expiresAt })
		const user = await consumeVerificationToken({ adapter, token, type: VERIFICATION_TOKEN_TYPES.PASSWORD_RESET })
		expect((user as { id: string }).id).toBe('u1')
		expect(adapter._tokens.has(tokenHash)).toBe(false)
	})

	it('returns null for expired tokens', async () => {
		const adapter = createAdapter()
		const token = 't2'
		const tokenHash = await sha256Hex(token)
		await adapter.create({ userId: 'u1', type: VERIFICATION_TOKEN_TYPES.PASSWORD_RESET, token: tokenHash, expiresAt: new Date(Date.now() - 1000) })
		const user = await consumeVerificationToken({ adapter, token, type: VERIFICATION_TOKEN_TYPES.PASSWORD_RESET })
		expect(user).toBeNull()
	})

	it('getUserForVerificationToken respects expiry and sanitize', async () => {
		const adapter = createAdapter()
		const token = 't3'
		const tokenHash = await sha256Hex(token)
		await adapter.create({ userId: 'u1', type: VERIFICATION_TOKEN_TYPES.EMAIL_UPDATE, token: tokenHash, expiresAt: new Date(Date.now() + 1000) })
		const user = await getUserForVerificationToken({
			adapter,
			token,
			type: VERIFICATION_TOKEN_TYPES.EMAIL_UPDATE,
			sanitizeUser: (u: Record<string, unknown>) => ({ id: u["id"] })
		})
		expect(user).toEqual({ id: 'u1' })
	})
})
