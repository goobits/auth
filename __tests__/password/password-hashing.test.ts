import { describe, expect, it } from 'vitest'

import {
	createPasswordMigrationVerifier,
	hashPassword,
	MAX_PASSWORD_LENGTH
} from '../../src/password/index.ts'
import { ARGON2_NATIVE_PACKAGE_IDS } from '../../src/password/nativePackages.ts'

const callHashPasswordUnsafe = (password: unknown) =>
	Reflect.apply(hashPassword, undefined, [password]) as Promise<string>

describe('Password Utilities', () => {
	it('publishes immutable native Argon2 package metadata for Node bundlers', () => {
		expect(Object.isFrozen(ARGON2_NATIVE_PACKAGE_IDS)).toBe(true)
		expect(ARGON2_NATIVE_PACKAGE_IDS[0]).toBe('@node-rs/argon2')
		expect(new Set(ARGON2_NATIVE_PACKAGE_IDS).size).toBe(ARGON2_NATIVE_PACKAGE_IDS.length)
		expect(
			ARGON2_NATIVE_PACKAGE_IDS.every((packageId) => packageId.startsWith('@node-rs/argon2'))
		).toBe(true)
	})

	describe('createPasswordMigrationVerifier', () => {
		const verifier = createPasswordMigrationVerifier({
			current: {
				matches: (hash) => hash.startsWith('current:'),
				verify: (hash, password) => hash === `current:${password}`
			},
			legacy: [
				{
					matches: (hash) => hash.startsWith('legacy:'),
					verify: (hash, password) => hash === `legacy:${password}`
				}
			]
		})

		it('accepts current hashes without rehash and marks accepted legacy hashes', async () => {
			await expect(verifier('current:correct', 'correct')).resolves.toEqual({
				valid: true,
				needsRehash: false
			})
			await expect(verifier('legacy:correct', 'correct')).resolves.toEqual({
				valid: true,
				needsRehash: true
			})
		})

		it('fails closed for unknown, malformed, and oversized inputs', async () => {
			await expect(verifier('unknown', 'correct')).resolves.toEqual({
				valid: false,
				needsRehash: false
			})
			await expect(
				verifier('legacy:correct', 'x'.repeat(MAX_PASSWORD_LENGTH + 1))
			).resolves.toEqual({ valid: false, needsRehash: false })
			const throwing = createPasswordMigrationVerifier({
				current: { matches: () => true, verify: () => Promise.reject(new Error('malformed')) }
			})
			await expect(throwing('current:value', 'correct')).resolves.toEqual({
				valid: false,
				needsRehash: false
			})
		})
	})

	describe('hashPassword', () => {
		it('should hash a password with Argon2id', async () => {
			const password = 'TestPassword123!'
			const hash = await hashPassword(password)

			expect(hash).toBeDefined()
			expect(typeof hash).toBe('string')
			expect(hash.startsWith('$argon2id$')).toBe(true)
			expect(hash).toContain('m=12288,t=3,p=1')
		})

		it('should produce different hashes for the same password', async () => {
			const password = 'SamePassword123!'
			const hash1 = await hashPassword(password)
			const hash2 = await hashPassword(password)

			expect(hash1).not.toBe(hash2) // Different salts
		})

		it('should throw error for empty password', async () => {
			await expect(hashPassword('')).rejects.toThrow('Password must be a non-empty string')
		})

		it('should throw error for null password', async () => {
			await expect(callHashPasswordUnsafe(null)).rejects.toThrow(
				'Password must be a non-empty string'
			)
		})

		it('should throw error for undefined password', async () => {
			await expect(callHashPasswordUnsafe(undefined)).rejects.toThrow(
				'Password must be a non-empty string'
			)
		})

		it('should throw error for non-string password', async () => {
			await expect(callHashPasswordUnsafe(12345)).rejects.toThrow(
				'Password must be a non-empty string'
			)
		})

		it('should handle very long passwords', async () => {
			const longPassword = 'a'.repeat(1000)
			const hash = await hashPassword(longPassword)

			expect(hash).toBeDefined()
			expect(hash.startsWith('$argon2id$')).toBe(true)
		})

		it('rejects passwords above the absolute hashing limit', async () => {
			await expect(hashPassword('a'.repeat(MAX_PASSWORD_LENGTH + 1))).rejects.toThrow(
				`at most ${MAX_PASSWORD_LENGTH} characters`
			)
		})

		it('should handle special characters in password', async () => {
			const password = '!@#$%^&*()_+-=[]{}|;:",.<>?/~`'
			const hash = await hashPassword(password)

			expect(hash).toBeDefined()
			expect(hash.startsWith('$argon2id$')).toBe(true)
		})

		it('should handle unicode characters in password', async () => {
			const password = 'Пароль123!你好'
			const hash = await hashPassword(password)

			expect(hash).toBeDefined()
			expect(hash.startsWith('$argon2id$')).toBe(true)
		})
	})
})
