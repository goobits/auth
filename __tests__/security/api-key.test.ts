import { describe, expect, it } from 'vitest'

import {
	createAuthApiKey,
	hashAuthApiKey,
	parseApiKeyHeader,
	timingSafeEqual,
	verifyAuthApiKey
} from '../../src/security/index.ts'

describe('auth API-key helpers', () => {
	describe('createAuthApiKey', () => {
		it('returns a prefixed hex string by default', async () => {
			const key = await createAuthApiKey()
			expect(key.startsWith('auth_')).toBe(true)
			const hex = key.slice(5)
			expect(hex).toMatch(/^[0-9a-f]+$/)
			expect(hex.length).toBe(64)
		})

		it('honors a custom prefix and byte length', async () => {
			const key = await createAuthApiKey({ prefix: 'test', bytes: 8 })
			expect(key.startsWith('test_')).toBe(true)
			expect(key.slice(5).length).toBe(16)
		})

		it('returns unique keys across calls', async () => {
			const a = await createAuthApiKey()
			const b = await createAuthApiKey()
			expect(a).not.toBe(b)
		})
	})

	describe('hashAuthApiKey', () => {
		it('returns a 64-char hex string', async () => {
			const hash = await hashAuthApiKey('some-api-key')
			expect(hash).toMatch(/^[0-9a-f]{64}$/)
		})

		it('changes when the salt changes', async () => {
			const a = await hashAuthApiKey('k', { salt: 'alpha' })
			const b = await hashAuthApiKey('k', { salt: 'beta' })
			expect(a).not.toBe(b)
		})

		it('throws when the apiKey is empty', async () => {
			await expect(hashAuthApiKey('')).rejects.toThrow('apiKey is required')
		})
	})

	describe('verifyAuthApiKey', () => {
		it('returns true when the apiKey matches the stored hash', async () => {
			const apiKey = await createAuthApiKey()
			const hash = await hashAuthApiKey(apiKey, { salt: 's' })
			const ok = await verifyAuthApiKey(apiKey, hash, { salt: 's' })
			expect(ok).toBe(true)
		})

		it('returns false when the apiKey does not match', async () => {
			const apiKey = await createAuthApiKey()
			const hash = await hashAuthApiKey(apiKey)
			const ok = await verifyAuthApiKey('wrong-key', hash)
			expect(ok).toBe(false)
		})

		it('returns false when the salt is different from the hashing salt', async () => {
			const apiKey = await createAuthApiKey()
			const hash = await hashAuthApiKey(apiKey, { salt: 'alpha' })
			const ok = await verifyAuthApiKey(apiKey, hash, { salt: 'beta' })
			expect(ok).toBe(false)
		})

		it('returns false when either input is empty', async () => {
			expect(await verifyAuthApiKey('', 'hash')).toBe(false)
			expect(await verifyAuthApiKey('key', '')).toBe(false)
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
