import { describe, expect, it } from 'vitest'

import { decryptTokens, encryptTokens } from '../../src/utils/crypto.ts'

describe('crypto utils', () => {
	it('round-trips token encryption/decryption', async () => {
		const key = 'a'.repeat(64)
		const payload = { accessToken: 'abc', refreshToken: 'def' }
		const encrypted = await encryptTokens(payload, key)
		const decrypted = await decryptTokens<typeof payload>(encrypted, key)
		expect(decrypted).toEqual(payload)
	})

	it('propagates encryption errors to the caller', async () => {
		await expect(encryptTokens({ a: 1 }, 'bad')).rejects.toThrow()
	})

	it('returns null for invalid encrypted input', async () => {
		const result = await decryptTokens('not-json', 'bad')
		expect(result).toBeNull()
	})
})
