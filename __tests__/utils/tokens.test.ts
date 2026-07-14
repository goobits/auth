import { describe, expect, it, vi } from 'vitest'

import {
	consumeVerificationToken,
	consumeVerificationTokenRecord,
	createVerificationToken,
	getUserForVerificationToken,
	getVerificationTokenRecord,
	hashVerificationToken,
	VERIFICATION_TOKEN_TYPES
} from '../../src/utils/index.ts'

type TokenRecord = {
	id: string
	token: string
	userId: string
	type: string
	expiresAt: Date
}

function createAdapter() {
	const tokens = new Map<string, TokenRecord>()
	const findByToken = async ({ token, type }: { token: string; type: string }) => {
		const record = tokens.get(token)
		if (!record || record.type !== type) return null
		return { token: record, user: { id: record.userId, password: 'secret' } }
	}
	return {
		deleteByUserAndType: vi.fn(async ({ userId, type }: { userId: string; type: string }) => {
			for (const [key, value] of tokens.entries()) {
				if (value.userId === userId && value.type === type) tokens.delete(key)
			}
		}),
		create: vi.fn(async ({ userId, type, token, expiresAt }: Omit<TokenRecord, 'id'>) => {
			tokens.set(token, { id: token, token, userId, type, expiresAt })
		}),
		findByToken: vi.fn(findByToken),
		deleteById: vi.fn(async (tokenId: string) => {
			tokens.delete(tokenId)
		}),
		consumeByToken: vi.fn(async (params: { token: string; type: string }) => {
			const record = await findByToken(params)
			if (record) tokens.delete(record.token.id)
			return record
		}),
		_tokens: tokens
	}
}

describe('verification tokens', () => {
	it('exposes one hashing boundary for adapter storage and lookup', async () => {
		expect(await hashVerificationToken('hello')).toBe(
			'2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'
		)
	})

	it('replaces existing tokens of the same type', async () => {
		const adapter = createAdapter()
		const token = await createVerificationToken({
			adapter,
			userId: 'u1',
			type: VERIFICATION_TOKEN_TYPES.EMAIL_VERIFICATION
		})
		const tokenHash = await hashVerificationToken(token)
		expect(adapter.deleteByUserAndType).toHaveBeenCalled()
		expect(adapter._tokens.has(tokenHash)).toBe(true)
	})

	it('forwards server-owned metadata to the persistence adapter', async () => {
		const adapter = createAdapter()
		await createVerificationToken({
			adapter,
			userId: 'u1',
			type: VERIFICATION_TOKEN_TYPES.MFA_LOGIN,
			metadata: { rememberMe: true }
		})

		expect(adapter.create).toHaveBeenCalledWith(
			expect.objectContaining({
				metadata: { rememberMe: true }
			})
		)
	})

	it('consumes and deletes token', async () => {
		const adapter = createAdapter()
		const expiresAt = new Date(Date.now() + 10000)
		const token = 't1'
		const tokenHash = await hashVerificationToken(token)
		await adapter.create({
			userId: 'u1',
			type: VERIFICATION_TOKEN_TYPES.PASSWORD_RESET,
			token: tokenHash,
			expiresAt
		})
		const user = await consumeVerificationToken({
			adapter,
			token,
			type: VERIFICATION_TOKEN_TYPES.PASSWORD_RESET
		})
		expect((user as { id: string }).id).toBe('u1')
		expect(adapter._tokens.has(tokenHash)).toBe(false)
	})

	it('returns null for expired tokens', async () => {
		const adapter = createAdapter()
		const token = 't2'
		const tokenHash = await hashVerificationToken(token)
		await adapter.create({
			userId: 'u1',
			type: VERIFICATION_TOKEN_TYPES.PASSWORD_RESET,
			token: tokenHash,
			expiresAt: new Date(Date.now() - 1000)
		})
		const user = await consumeVerificationToken({
			adapter,
			token,
			type: VERIFICATION_TOKEN_TYPES.PASSWORD_RESET
		})
		expect(user).toBeNull()
	})

	it('getUserForVerificationToken respects expiry and sanitize', async () => {
		const adapter = createAdapter()
		const token = 't3'
		const tokenHash = await hashVerificationToken(token)
		await adapter.create({
			userId: 'u1',
			type: VERIFICATION_TOKEN_TYPES.EMAIL_UPDATE,
			token: tokenHash,
			expiresAt: new Date(Date.now() + 1000)
		})
		const user = await getUserForVerificationToken({
			adapter,
			token,
			type: VERIFICATION_TOKEN_TYPES.EMAIL_UPDATE,
			sanitizeUser: (u: Record<string, unknown>) => ({ id: u['id'] })
		})
		expect(user).toEqual({ id: 'u1' })
	})

	it('exposes record-level inspection and atomic consumption', async () => {
		const adapter = createAdapter()
		const token = 'record-token'
		const tokenHash = await hashVerificationToken(token)
		await adapter.create({
			userId: 'u1',
			type: VERIFICATION_TOKEN_TYPES.EMAIL_UPDATE,
			token: tokenHash,
			expiresAt: new Date(Date.now() + 1000)
		})

		const inspected = await getVerificationTokenRecord({
			adapter,
			token,
			type: VERIFICATION_TOKEN_TYPES.EMAIL_UPDATE
		})
		expect(inspected?.user).toMatchObject({ id: 'u1' })

		const consumed = await consumeVerificationTokenRecord({
			adapter,
			token,
			type: VERIFICATION_TOKEN_TYPES.EMAIL_UPDATE
		})
		expect(consumed?.user).toMatchObject({ id: 'u1' })
		expect(adapter._tokens.has(tokenHash)).toBe(false)
	})
})
