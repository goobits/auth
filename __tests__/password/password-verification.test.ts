import { describe, expect, it } from 'vitest'
import { argon2id } from 'hash-wasm'

import { hashPassword, MAX_PASSWORD_LENGTH, verifyPassword } from '../../src/password/index.ts'

const callVerifyPasswordUnsafe = (hash: unknown, password: unknown) =>
	Reflect.apply(verifyPassword, undefined, [hash, password]) as Promise<boolean>

describe('Password Utilities', () => {
	describe('verifyPassword', () => {
		it('continues to verify hashes created with the previous cost', async () => {
			const password = 'ExistingPassword123!'
			const legacyHash = await argon2id({
				password,
				salt: new Uint8Array(16).fill(7),
				iterations: 2,
				memorySize: 12_288,
				parallelism: 1,
				hashLength: 32,
				outputType: 'encoded'
			})

			await expect(verifyPassword(legacyHash, password)).resolves.toBe(true)
		})

		it('should verify correct password', async () => {
			const password = 'CorrectPassword123!'
			const hash = await hashPassword(password)

			const isValid = await verifyPassword(hash, password)
			expect(isValid).toBe(true)
		})

		it('should reject incorrect password', async () => {
			const password = 'CorrectPassword123!'
			const hash = await hashPassword(password)

			const isValid = await verifyPassword(hash, 'WrongPassword123!')
			expect(isValid).toBe(false)
		})

		it('should return false for invalid hash format', async () => {
			const isValid = await verifyPassword('invalid-hash', 'password')
			expect(isValid).toBe(false)
		})

		it('should return false for empty hash', async () => {
			const isValid = await verifyPassword('', 'password')
			expect(isValid).toBe(false)
		})

		it('should return false for null hash', async () => {
			const isValid = await callVerifyPasswordUnsafe(null, 'password')
			expect(isValid).toBe(false)
		})

		it('should return false for empty password', async () => {
			const hash = await hashPassword('ValidPassword123!')
			const isValid = await verifyPassword(hash, '')
			expect(isValid).toBe(false)
		})

		it('should return false for null password', async () => {
			const hash = await hashPassword('ValidPassword123!')
			const isValid = await callVerifyPasswordUnsafe(hash, null)
			expect(isValid).toBe(false)
		})

		it('rejects oversized passwords before verification', async () => {
			const hash = await hashPassword('ValidPassword123!')
			await expect(verifyPassword(hash, 'a'.repeat(MAX_PASSWORD_LENGTH + 1))).resolves.toBe(false)
		})

		it('should handle case-sensitive passwords correctly', async () => {
			const password = 'CaseSensitive123!'
			const hash = await hashPassword(password)

			const isValidCorrectCase = await verifyPassword(hash, 'CaseSensitive123!')
			const isValidWrongCase = await verifyPassword(hash, 'casesensitive123!')

			expect(isValidCorrectCase).toBe(true)
			expect(isValidWrongCase).toBe(false)
		})

		it('should handle special characters correctly', async () => {
			const password = '!@#$%^&*()_+-='
			const hash = await hashPassword(password)

			const isValid = await verifyPassword(hash, password)
			expect(isValid).toBe(true)
		})

		it('should handle unicode characters correctly', async () => {
			const password = 'Пароль123!你好'
			const hash = await hashPassword(password)

			const isValid = await verifyPassword(hash, password)
			expect(isValid).toBe(true)
		})
	})
})
