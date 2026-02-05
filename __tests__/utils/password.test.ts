/**
 * Unit Tests for Password Utilities
 *
 * Tests password hashing, verification, and validation functions.
 *
 * To run these tests:
 * cd packages/@goobits/auth
 * npx vitest run __tests__/utils/password.test.ts
 */

import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, validatePasswordStrength } from '../../src/utils/password.ts';

const callHashPasswordUnsafe = (password: unknown) =>
	Reflect.apply(hashPassword, undefined, [password]) as Promise<string>;
const callVerifyPasswordUnsafe = (hash: unknown, password: unknown) =>
	Reflect.apply(verifyPassword, undefined, [hash, password]) as Promise<boolean>;
const callValidatePasswordStrengthUnsafe = (password: unknown) =>
	Reflect.apply(validatePasswordStrength, undefined, [password]) as {
		valid: boolean;
		errors: string[];
	};

describe('Password Utilities', () => {
	describe('hashPassword', () => {
		it('should hash a password with Argon2id', async () => {
			const password = 'TestPassword123!';
			const hash = await hashPassword(password);

			expect(hash).toBeDefined();
			expect(typeof hash).toBe('string');
			expect(hash.startsWith('$argon2id$')).toBe(true);
		});

		it('should produce different hashes for the same password', async () => {
			const password = 'SamePassword123!';
			const hash1 = await hashPassword(password);
			const hash2 = await hashPassword(password);

			expect(hash1).not.toBe(hash2); // Different salts
		});

		it('should throw error for empty password', async () => {
			await expect(hashPassword('')).rejects.toThrow('Password must be a non-empty string');
		});

		it('should throw error for null password', async () => {
			await expect(callHashPasswordUnsafe(null)).rejects.toThrow('Password must be a non-empty string');
		});

		it('should throw error for undefined password', async () => {
			await expect(callHashPasswordUnsafe(undefined)).rejects.toThrow('Password must be a non-empty string');
		});

		it('should throw error for non-string password', async () => {
			await expect(callHashPasswordUnsafe(12345)).rejects.toThrow('Password must be a non-empty string');
		});

		it('should handle very long passwords', async () => {
			const longPassword = 'a'.repeat(1000);
			const hash = await hashPassword(longPassword);

			expect(hash).toBeDefined();
			expect(hash.startsWith('$argon2id$')).toBe(true);
		});

		it('should handle special characters in password', async () => {
			const password = '!@#$%^&*()_+-=[]{}|;:",.<>?/~`';
			const hash = await hashPassword(password);

			expect(hash).toBeDefined();
			expect(hash.startsWith('$argon2id$')).toBe(true);
		});

		it('should handle unicode characters in password', async () => {
			const password = 'Пароль123!你好';
			const hash = await hashPassword(password);

			expect(hash).toBeDefined();
			expect(hash.startsWith('$argon2id$')).toBe(true);
		});
	});

	describe('verifyPassword', () => {
		it('should verify correct password', async () => {
			const password = 'CorrectPassword123!';
			const hash = await hashPassword(password);

			const isValid = await verifyPassword(hash, password);
			expect(isValid).toBe(true);
		});

		it('should reject incorrect password', async () => {
			const password = 'CorrectPassword123!';
			const hash = await hashPassword(password);

			const isValid = await verifyPassword(hash, 'WrongPassword123!');
			expect(isValid).toBe(false);
		});

		it('should return false for invalid hash format', async () => {
			const isValid = await verifyPassword('invalid-hash', 'password');
			expect(isValid).toBe(false);
		});

		it('should return false for empty hash', async () => {
			const isValid = await verifyPassword('', 'password');
			expect(isValid).toBe(false);
		});

		it('should return false for null hash', async () => {
			const isValid = await callVerifyPasswordUnsafe(null, 'password');
			expect(isValid).toBe(false);
		});

		it('should return false for empty password', async () => {
			const hash = await hashPassword('ValidPassword123!');
			const isValid = await verifyPassword(hash, '');
			expect(isValid).toBe(false);
		});

		it('should return false for null password', async () => {
			const hash = await hashPassword('ValidPassword123!');
			const isValid = await callVerifyPasswordUnsafe(hash, null);
			expect(isValid).toBe(false);
		});

		it('should handle case-sensitive passwords correctly', async () => {
			const password = 'CaseSensitive123!';
			const hash = await hashPassword(password);

			const isValidCorrectCase = await verifyPassword(hash, 'CaseSensitive123!');
			const isValidWrongCase = await verifyPassword(hash, 'casesensitive123!');

			expect(isValidCorrectCase).toBe(true);
			expect(isValidWrongCase).toBe(false);
		});

		it('should handle special characters correctly', async () => {
			const password = '!@#$%^&*()_+-=';
			const hash = await hashPassword(password);

			const isValid = await verifyPassword(hash, password);
			expect(isValid).toBe(true);
		});

		it('should handle unicode characters correctly', async () => {
			const password = 'Пароль123!你好';
			const hash = await hashPassword(password);

			const isValid = await verifyPassword(hash, password);
			expect(isValid).toBe(true);
		});
	});

	describe('validatePasswordStrength', () => {
		describe('valid passwords', () => {
			it('should accept strong password with all requirements', () => {
				const result = validatePasswordStrength('StrongPassword123');
				expect(result.valid).toBe(true);
				expect(result.errors).toHaveLength(0);
			});

			it('should accept password with special characters', () => {
				const result = validatePasswordStrength('StrongPass123!@#');
				expect(result.valid).toBe(true);
				expect(result.errors).toHaveLength(0);
			});

			it('should accept minimum length password with requirements', () => {
				const result = validatePasswordStrength('Pass123A');
				expect(result.valid).toBe(true);
				expect(result.errors).toHaveLength(0);
			});

			it('should accept very long password', () => {
				const result = validatePasswordStrength('VeryLongPassword123WithManyCharacters');
				expect(result.valid).toBe(true);
				expect(result.errors).toHaveLength(0);
			});
		});

		describe('invalid passwords - length', () => {
			it('should reject password that is too short', () => {
				const result = validatePasswordStrength('Short1');
				expect(result.valid).toBe(false);
				expect(result.errors).toContain('Password must be at least 8 characters long');
			});

			it('should reject empty password', () => {
				const result = validatePasswordStrength('');
				expect(result.valid).toBe(false);
				expect(result.errors).toContain('Password is required');
			});

			it('should reject null password', () => {
			const result = callValidatePasswordStrengthUnsafe(null);
				expect(result.valid).toBe(false);
				expect(result.errors).toContain('Password is required');
			});

			it('should reject undefined password', () => {
			const result = callValidatePasswordStrengthUnsafe(undefined);
				expect(result.valid).toBe(false);
				expect(result.errors).toContain('Password is required');
			});
		});

		describe('invalid passwords - missing character types', () => {
			it('should reject password without lowercase letters', () => {
				const result = validatePasswordStrength('PASSWORD123');
				expect(result.valid).toBe(false);
				expect(result.errors).toContain('Password must contain at least one lowercase letter');
			});

			it('should reject password without uppercase letters', () => {
				const result = validatePasswordStrength('password123');
				expect(result.valid).toBe(false);
				expect(result.errors).toContain('Password must contain at least one uppercase letter');
			});

			it('should reject password without numbers', () => {
				const result = validatePasswordStrength('PasswordOnly');
				expect(result.valid).toBe(false);
				expect(result.errors).toContain('Password must contain at least one number');
			});

			it('should reject password with only lowercase', () => {
				const result = validatePasswordStrength('onlylowercase');
				expect(result.valid).toBe(false);
				expect(result.errors.length).toBeGreaterThan(0); // missing uppercase and number
				expect(result.errors).toContain('Password must contain at least one uppercase letter');
				expect(result.errors).toContain('Password must contain at least one number');
			});

			it('should reject password with only numbers', () => {
				const result = validatePasswordStrength('123456789');
				expect(result.valid).toBe(false);
				expect(result.errors.length).toBeGreaterThan(0);
			});
		});

		describe('multiple validation errors', () => {
			it('should return all validation errors for weak password', () => {
				const result = validatePasswordStrength('weak');
				expect(result.valid).toBe(false);
				expect(result.errors.length).toBeGreaterThan(1);
				expect(result.errors).toContain('Password must be at least 8 characters long');
				expect(result.errors).toContain('Password must contain at least one uppercase letter');
				expect(result.errors).toContain('Password must contain at least one number');
			});

			it('should return all errors for very weak password', () => {
				const result = validatePasswordStrength('a');
				expect(result.valid).toBe(false);
				expect(result.errors.length).toBe(3);
			});
		});

		describe('edge cases', () => {
			it('should handle password with only spaces', () => {
				const result = validatePasswordStrength('        ');
				expect(result.valid).toBe(false);
			});

			it('should handle password with special characters only', () => {
				const result = validatePasswordStrength('!@#$%^&*()');
				expect(result.valid).toBe(false);
			});

			it('should accept password with spaces if it meets requirements', () => {
				const result = validatePasswordStrength('Pass Word 123');
				expect(result.valid).toBe(true);
			});

			it('should handle unicode characters', () => {
				// Cyrillic characters don't match ASCII letter patterns [a-zA-Z]
				const result = validatePasswordStrength('Пароль123');
				// Has numbers (123) but lacks ASCII letters
				expect(result.valid).toBe(false);
				expect(result.errors).toContain('Password must contain at least one lowercase letter');
				expect(result.errors).toContain('Password must contain at least one uppercase letter');
			});
		});
	});

	describe('integration - hash and verify workflow', () => {
		it('should successfully hash and verify in sequence', async () => {
			const password = 'IntegrationTest123!';

			// Hash the password
			const hash = await hashPassword(password);
			expect(hash).toBeDefined();

			// Verify with correct password
			const isValidCorrect = await verifyPassword(hash, password);
			expect(isValidCorrect).toBe(true);

			// Verify with incorrect password
			const isValidIncorrect = await verifyPassword(hash, 'WrongPassword123!');
			expect(isValidIncorrect).toBe(false);
		});

		it('should validate then hash then verify', async () => {
			const password = 'CompleteFlow123!';

			// Validate
			const validation = validatePasswordStrength(password);
			expect(validation.valid).toBe(true);

			// Hash
			const hash = await hashPassword(password);
			expect(hash).toBeDefined();

			// Verify
			const isValid = await verifyPassword(hash, password);
			expect(isValid).toBe(true);
		});

		it('should reject weak password in complete workflow', async () => {
			const weakPassword = 'weak';

			// Validate (should fail)
			const validation = validatePasswordStrength(weakPassword);
			expect(validation.valid).toBe(false);
			expect(validation.errors.length).toBeGreaterThan(0);

			// In real app, we wouldn't proceed to hash if validation fails
			// But testing that hash still works even with weak password
			const hash = await hashPassword(weakPassword);
			const isValid = await verifyPassword(hash, weakPassword);
			expect(isValid).toBe(true); // Hash/verify work regardless of strength
		});
	});
});
