import { describe, expect, it } from 'vitest'

import {
	hashPassword,
	MAX_PASSWORD_LENGTH,
	validatePasswordStrength,
	verifyPassword
} from '../../src/password/index.ts'

const callValidatePasswordStrengthUnsafe = (password: unknown) =>
	Reflect.apply(validatePasswordStrength, undefined, [password]) as {
		valid: boolean
		errors: string[]
	}

describe('Password Utilities', () => {
	describe('validatePasswordStrength', () => {
		describe('valid passwords', () => {
			it('should accept strong password with all requirements', () => {
				const result = validatePasswordStrength('StrongPassword123')
				expect(result.valid).toBe(true)
				expect(result.errors).toHaveLength(0)
			})

			it('should accept password with special characters', () => {
				const result = validatePasswordStrength('StrongPass123!@#')
				expect(result.valid).toBe(true)
				expect(result.errors).toHaveLength(0)
			})

			it('should accept minimum length password with requirements', () => {
				const result = validatePasswordStrength('Pass123A')
				expect(result.valid).toBe(true)
				expect(result.errors).toHaveLength(0)
			})

			it('should accept very long password', () => {
				const result = validatePasswordStrength('VeryLongPassword123WithManyCharacters')
				expect(result.valid).toBe(true)
				expect(result.errors).toHaveLength(0)
			})
		})

		describe('invalid passwords - length', () => {
			it('should reject password that is too short', () => {
				const result = validatePasswordStrength('Short1')
				expect(result.valid).toBe(false)
				expect(result.errors).toContain('Password must be at least 8 characters long')
			})

			it('should reject empty password', () => {
				const result = validatePasswordStrength('')
				expect(result.valid).toBe(false)
				expect(result.errors).toContain('Password is required')
			})

			it('should reject null password', () => {
				const result = callValidatePasswordStrengthUnsafe(null)
				expect(result.valid).toBe(false)
				expect(result.errors).toContain('Password is required')
			})

			it('should reject undefined password', () => {
				const result = callValidatePasswordStrengthUnsafe(undefined)
				expect(result.valid).toBe(false)
				expect(result.errors).toContain('Password is required')
			})

			it('rejects passwords above the absolute length limit', () => {
				const result = validatePasswordStrength('A1a'.repeat(MAX_PASSWORD_LENGTH))
				expect(result.valid).toBe(false)
				expect(result.errors).toContain(
					`Password must be at most ${MAX_PASSWORD_LENGTH} characters long`
				)
			})
		})

		describe('invalid passwords - missing character types', () => {
			it('should reject password without lowercase letters', () => {
				const result = validatePasswordStrength('PASSWORD123')
				expect(result.valid).toBe(false)
				expect(result.errors).toContain('Password must contain at least one lowercase letter')
			})

			it('should reject password without uppercase letters', () => {
				const result = validatePasswordStrength('password123')
				expect(result.valid).toBe(false)
				expect(result.errors).toContain('Password must contain at least one uppercase letter')
			})

			it('should reject password without numbers', () => {
				const result = validatePasswordStrength('PasswordOnly')
				expect(result.valid).toBe(false)
				expect(result.errors).toContain('Password must contain at least one number')
			})

			it('should reject password with only lowercase', () => {
				const result = validatePasswordStrength('onlylowercase')
				expect(result.valid).toBe(false)
				expect(result.errors.length).toBeGreaterThan(0) // missing uppercase and number
				expect(result.errors).toContain('Password must contain at least one uppercase letter')
				expect(result.errors).toContain('Password must contain at least one number')
			})

			it('should reject password with only numbers', () => {
				const result = validatePasswordStrength('123456789')
				expect(result.valid).toBe(false)
				expect(result.errors.length).toBeGreaterThan(0)
			})
		})

		describe('multiple validation errors', () => {
			it('should return all validation errors for weak password', () => {
				const result = validatePasswordStrength('weak')
				expect(result.valid).toBe(false)
				expect(result.errors.length).toBeGreaterThan(1)
				expect(result.errors).toContain('Password must be at least 8 characters long')
				expect(result.errors).toContain('Password must contain at least one uppercase letter')
				expect(result.errors).toContain('Password must contain at least one number')
			})

			it('should return all errors for very weak password', () => {
				const result = validatePasswordStrength('a')
				expect(result.valid).toBe(false)
				expect(result.errors.length).toBe(3)
			})
		})

		describe('edge cases', () => {
			it('should handle password with only spaces', () => {
				const result = validatePasswordStrength('        ')
				expect(result.valid).toBe(false)
			})

			it('should handle password with special characters only', () => {
				const result = validatePasswordStrength('!@#$%^&*()')
				expect(result.valid).toBe(false)
			})

			it('should accept password with spaces if it meets requirements', () => {
				const result = validatePasswordStrength('Pass Word 123')
				expect(result.valid).toBe(true)
			})

			it('should handle unicode characters', () => {
				// Cyrillic characters don't match ASCII letter patterns [a-zA-Z]
				const result = validatePasswordStrength('Пароль123')

				// Has numbers (123) but lacks ASCII letters
				expect(result.valid).toBe(false)
				expect(result.errors).toContain('Password must contain at least one lowercase letter')
				expect(result.errors).toContain('Password must contain at least one uppercase letter')
			})
		})
	})

	describe('integration - hash and verify workflow', () => {
		it('should successfully hash and verify in sequence', async () => {
			const password = 'IntegrationTest123!'

			// Hash the password
			const hash = await hashPassword(password)
			expect(hash).toBeDefined()

			// Verify with correct password
			const isValidCorrect = await verifyPassword(hash, password)
			expect(isValidCorrect).toBe(true)

			// Verify with incorrect password
			const isValidIncorrect = await verifyPassword(hash, 'WrongPassword123!')
			expect(isValidIncorrect).toBe(false)
		})

		it('should validate then hash then verify', async () => {
			const password = 'CompleteFlow123!'

			// Validate
			const validation = validatePasswordStrength(password)
			expect(validation.valid).toBe(true)

			// Hash
			const hash = await hashPassword(password)
			expect(hash).toBeDefined()

			// Verify
			const isValid = await verifyPassword(hash, password)
			expect(isValid).toBe(true)
		})

		it('should reject weak password in complete workflow', async () => {
			const weakPassword = 'weak'

			// Validate (should fail)
			const validation = validatePasswordStrength(weakPassword)
			expect(validation.valid).toBe(false)
			expect(validation.errors.length).toBeGreaterThan(0)

			// In real app, we wouldn't proceed to hash if validation fails
			// But testing that hash still works even with weak password
			const hash = await hashPassword(weakPassword)
			const isValid = await verifyPassword(hash, weakPassword)
			expect(isValid).toBe(true) // Hash/verify work regardless of strength
		})
	})
})
