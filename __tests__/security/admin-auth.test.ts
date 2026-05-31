import { describe, expect, it } from 'vitest'

import {
	createAdminApiKey,
	hashAdminApiKey,
	parseApiKeyHeader,
	timingSafeEqual,
	verifyAdminApiKey
} from '../../src/security/admin-auth.ts'

describe('admin-auth', () => {
	describe('createAdminApiKey', () => {
		it('returns a prefixed hex string by default', async() => {
			const key = await createAdminApiKey()
			expect(key.startsWith('adm_')).toBe(true)
			const hex = key.slice(4)
			expect(hex).toMatch(/^[0-9a-f]+$/)

			// 32 bytes -> 64 hex chars
			expect(hex.length).toBe(64)
		})

		it('honors a custom prefix and byte length', async() => {
			const key = await createAdminApiKey({ prefix: 'test', bytes: 8 })
			expect(key.startsWith('test_')).toBe(true)
			expect(key.slice(5).length).toBe(16)
		})

		it('returns unique keys across calls', async() => {
			const a = await createAdminApiKey()
			const b = await createAdminApiKey()
			expect(a).not.toBe(b)
		})
	})

	describe('hashAdminApiKey', () => {
		it('returns a 64-char hex string', async() => {
			const hash = await hashAdminApiKey('some-api-key')
			expect(hash).toMatch(/^[0-9a-f]{64}$/)
		})

		it('changes when the salt changes', async() => {
			const a = await hashAdminApiKey('k', { salt: 'alpha' })
			const b = await hashAdminApiKey('k', { salt: 'beta' })
			expect(a).not.toBe(b)
		})

		it('throws when the apiKey is empty', async() => {
			await expect(hashAdminApiKey('')).rejects.toThrow('apiKey is required')
		})
	})

	describe('verifyAdminApiKey', () => {
		it('returns true when the apiKey matches the stored hash', async() => {
			const apiKey = await createAdminApiKey()
			const hash = await hashAdminApiKey(apiKey, { salt: 's' })
			const ok = await verifyAdminApiKey(apiKey, hash, { salt: 's' })
			expect(ok).toBe(true)
		})

		it('returns false when the apiKey does not match', async() => {
			const apiKey = await createAdminApiKey()
			const hash = await hashAdminApiKey(apiKey)
			const ok = await verifyAdminApiKey('wrong-key', hash)
			expect(ok).toBe(false)
		})

		it('returns false when the salt is different from the hashing salt', async() => {
			const apiKey = await createAdminApiKey()
			const hash = await hashAdminApiKey(apiKey, { salt: 'alpha' })
			const ok = await verifyAdminApiKey(apiKey, hash, { salt: 'beta' })
			expect(ok).toBe(false)
		})

		it('returns false when either input is empty', async() => {
			expect(await verifyAdminApiKey('', 'hash')).toBe(false)
			expect(await verifyAdminApiKey('key', '')).toBe(false)
		})
	})

	describe('parseApiKeyHeader', () => {
		it('returns null for null/empty input', () => {
			expect(parseApiKeyHeader(null)).toBe(null)
			expect(parseApiKeyHeader('')).toBe(null)
		})

		it('strips the `ApiKey ` prefix', () => {
			expect(parseApiKeyHeader('ApiKey abc123')).toBe('abc123')
		})

		it('strips the `Bearer ` prefix', () => {
			expect(parseApiKeyHeader('Bearer xyz789')).toBe('xyz789')
		})

		it('returns the raw value when no recognized prefix is present', () => {
			expect(parseApiKeyHeader('raw-token')).toBe('raw-token')
		})
	})

	describe('timingSafeEqual', () => {
		it('returns true for identical strings', () => {
			expect(timingSafeEqual('abc', 'abc')).toBe(true)
		})

		it('returns false for different strings of equal length', () => {
			expect(timingSafeEqual('abc', 'abd')).toBe(false)
		})

		it('returns false for strings of different lengths', () => {
			expect(timingSafeEqual('abc', 'abcd')).toBe(false)
		})

		it('returns false when either input is empty', () => {
			expect(timingSafeEqual('', '')).toBe(false)
			expect(timingSafeEqual('a', '')).toBe(false)
		})
	})
})
