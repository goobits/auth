/**
 * Unit Tests for CredentialsProvider
 *
 * Tests local email/password authentication provider.
 *
 * To run these tests:
 * cd packages/@goobits/auth
 * npx vitest run __tests__/providers/CredentialsProvider.test.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CredentialsProvider } from '../../src/providers/credentials.ts';
import { hashPassword } from '../../src/utils/password.ts';
import type { UserAdapter } from '../../src/adapters/database/base.ts';

type MockUserAdapter = Pick<
	UserAdapter,
	'getUserByEmail' | 'createUser' | 'updateUser' | 'getUserWithPasswordHash'
>;

describe('CredentialsProvider', () => {
	let provider: CredentialsProvider;
	let mockUserAdapter: MockUserAdapter;

	beforeEach(() => {
		// Create mock user adapter
		mockUserAdapter = {
			getUserByEmail: vi.fn(),
			createUser: vi.fn(),
			updateUser: vi.fn(),
			getUserWithPasswordHash: vi.fn(),
		};

		provider = new CredentialsProvider();
	});

	describe('constructor', () => {
		it('should create provider with default options', () => {
			expect(provider).toBeDefined();
			expect(provider.name).toBe('credentials');
		});

		it('should accept custom password validator', () => {
			const customValidator = vi.fn(() => ({ valid: true, errors: [] }));
			const customProvider = new CredentialsProvider({
				validatePassword: customValidator,
			});

			expect(customProvider.validatePassword).toBe(customValidator);
		});
	});

	describe('authenticate', () => {
		it('should authenticate user with valid credentials', async () => {
			const email = 'test@example.com';
			const password = 'ValidPassword123!';
			const hashedPassword = await hashPassword(password);

			// Mock getUserWithPasswordHash to return user with password
			mockUserAdapter.getUserWithPasswordHash.mockResolvedValue({
				id: 'user-123',
				email,
				password: hashedPassword,
				name: 'Test User',
			});

			// Mock getUserByEmail to return sanitized user
			mockUserAdapter.getUserByEmail.mockResolvedValue({
				id: 'user-123',
				email,
				name: 'Test User',
			});

			const result = await provider.authenticate({
				email,
				password,
				userAdapter: mockUserAdapter,
			});

			expect(result.valid).toBe(true);
			expect(result.user).toBeDefined();
			if (!result.user) throw new Error('Expected user');
			expect(result.user.id).toBe('user-123');
			expect(result.user.password).toBeUndefined(); // Should be sanitized
			expect(mockUserAdapter.getUserWithPasswordHash).toHaveBeenCalledWith(email);
			expect(mockUserAdapter.getUserByEmail).toHaveBeenCalledWith(email);
		});

		it('should reject authentication with incorrect password', async () => {
			const email = 'test@example.com';
			const correctPassword = 'CorrectPassword123!';
			const incorrectPassword = 'WrongPassword123!';
			const hashedPassword = await hashPassword(correctPassword);

			mockUserAdapter.getUserWithPasswordHash.mockResolvedValue({
				id: 'user-123',
				email,
				password: hashedPassword,
			});

			const result = await provider.authenticate({
				email,
				password: incorrectPassword,
				userAdapter: mockUserAdapter,
			});

			expect(result.valid).toBe(false);
			expect(result.user).toBeNull();
			expect(mockUserAdapter.getUserByEmail).not.toHaveBeenCalled();
		});

		it('should reject authentication for non-existent user', async () => {
			mockUserAdapter.getUserWithPasswordHash.mockResolvedValue(null);

			const result = await provider.authenticate({
				email: 'nonexistent@example.com',
				password: 'SomePassword123!',
				userAdapter: mockUserAdapter,
			});

			expect(result.valid).toBe(false);
			expect(result.user).toBeNull();
		});

		it('should reject authentication for user without password', async () => {
			mockUserAdapter.getUserWithPasswordHash.mockResolvedValue({
				id: 'user-123',
				email: 'oauth-user@example.com',
				password: null, // OAuth user without password
			});

			const result = await provider.authenticate({
				email: 'oauth-user@example.com',
				password: 'SomePassword123!',
				userAdapter: mockUserAdapter,
			});

			expect(result.valid).toBe(false);
			expect(result.user).toBeNull();
		});

		it('should reject authentication with empty email', async () => {
			const result = await provider.authenticate({
				email: '',
				password: 'ValidPassword123!',
				userAdapter: mockUserAdapter,
			});

			expect(result.valid).toBe(false);
			expect(result.user).toBeNull();
			expect(mockUserAdapter.getUserWithPasswordHash).not.toHaveBeenCalled();
		});

		it('should reject authentication with empty password', async () => {
			const result = await provider.authenticate({
				email: 'test@example.com',
				password: '',
				userAdapter: mockUserAdapter,
			});

			expect(result.valid).toBe(false);
			expect(result.user).toBeNull();
			expect(mockUserAdapter.getUserWithPasswordHash).not.toHaveBeenCalled();
		});

		it('should handle email case-insensitively', async () => {
			const email = 'Test@Example.COM';
			const password = 'ValidPassword123!';
			const hashedPassword = await hashPassword(password);

			mockUserAdapter.getUserWithPasswordHash.mockResolvedValue({
				id: 'user-123',
				email: email.toLowerCase(),
				password: hashedPassword,
			});

			mockUserAdapter.getUserByEmail.mockResolvedValue({
				id: 'user-123',
				email: email.toLowerCase(),
			});

			const result = await provider.authenticate({
				email,
				password,
				userAdapter: mockUserAdapter,
			});

			expect(result.valid).toBe(true);
			expect(mockUserAdapter.getUserWithPasswordHash).toHaveBeenCalledWith(email.toLowerCase());
		});
	});

	describe('signUp', () => {
		it('should create user with hashed password', async () => {
			const email = 'newuser@example.com';
			const password = 'SecurePassword123!';
			const name = 'New User';

			mockUserAdapter.createUser.mockResolvedValue({
				id: 'user-new',
				email,
				name,
			});

			const user = await provider.signUp({
				email,
				password,
				name,
				userAdapter: mockUserAdapter,
			});

			expect(user).toBeDefined();
			expect(user.id).toBe('user-new');
			expect(user.email).toBe(email);
			expect(user.password).toBeUndefined(); // Should be sanitized

			// Verify createUser was called with hashed password
			expect(mockUserAdapter.createUser).toHaveBeenCalledWith(
				expect.objectContaining({
					email,
					name,
					verified_email: false,
				}),
				expect.objectContaining({
					provider: 'email',
					emailVerified: false,
					password: expect.stringMatching(/^\$argon2id\$/), // Argon2id hash format
				}),
			);
		});

		it('should create user without name (use email prefix)', async () => {
			const email = 'newuser@example.com';
			const password = 'SecurePassword123!';

			mockUserAdapter.createUser.mockResolvedValue({
				id: 'user-new',
				email,
				name: 'newuser', // Derived from email
			});

			const user = await provider.signUp({
				email,
				password,
				userAdapter: mockUserAdapter,
			});

			expect(mockUserAdapter.createUser).toHaveBeenCalledWith(
				expect.objectContaining({
					email,
					name: 'newuser', // Should use email prefix
				}),
				expect.any(Object),
			);
		});

		it('should throw error for empty email', async () => {
			await expect(
				provider.signUp({
					email: '',
					password: 'ValidPassword123!',
					userAdapter: mockUserAdapter,
				}),
			).rejects.toThrow('Email and password are required');
		});

		it('should throw error for empty password', async () => {
			await expect(
				provider.signUp({
					email: 'test@example.com',
					password: '',
					userAdapter: mockUserAdapter,
				}),
			).rejects.toThrow('Email and password are required');
		});

		it('should validate password with custom validator', async () => {
			const customValidator = vi.fn(() => ({
				valid: false,
				errors: ['Password too weak'],
			}));

			const customProvider = new CredentialsProvider({
				validatePassword: customValidator,
			});

			await expect(
				customProvider.signUp({
					email: 'test@example.com',
					password: 'weak',
					userAdapter: mockUserAdapter,
				}),
			).rejects.toThrow('Password too weak');

			expect(customValidator).toHaveBeenCalledWith('weak');
		});

		it('should include additional metadata', async () => {
			const email = 'user@example.com';
			const password = 'Password123!';
			const metadata = {
				role: 'admin',
				verified: true,
			};

			mockUserAdapter.createUser.mockResolvedValue({
				id: 'user-123',
				email,
			});

			await provider.signUp({
				email,
				password,
				metadata,
				userAdapter: mockUserAdapter,
			});

			expect(mockUserAdapter.createUser).toHaveBeenCalledWith(
				expect.any(Object),
				expect.objectContaining({
					role: 'admin',
					verified: true,
				}),
			);
		});

		it('should handle email case-insensitively', async () => {
			const email = 'NewUser@Example.COM';
			const password = 'Password123!';

			mockUserAdapter.createUser.mockResolvedValue({
				id: 'user-123',
				email: email.toLowerCase(),
			});

			await provider.signUp({
				email,
				password,
				userAdapter: mockUserAdapter,
			});

			expect(mockUserAdapter.createUser).toHaveBeenCalledWith(
				expect.objectContaining({
					email: email.toLowerCase(),
				}),
				expect.any(Object),
			);
		});
	});

	describe('updatePassword', () => {
		it('should update password with hashed value', async () => {
			const userId = 'user-123';
			const newPassword = 'NewPassword123!';

			mockUserAdapter.updateUser.mockResolvedValue({
				id: userId,
				email: 'test@example.com',
			});

			const user = await provider.updatePassword({
				userId,
				newPassword,
				userAdapter: mockUserAdapter,
			});

			expect(user).toBeDefined();
			expect(user.id).toBe(userId);
			expect(mockUserAdapter.updateUser).toHaveBeenCalledWith(
				userId,
				expect.objectContaining({
					password: expect.stringMatching(/^\$argon2id\$/),
				}),
			);
		});

		it('should throw error for missing userId', async () => {
			await expect(
				provider.updatePassword({
					userId: '',
					newPassword: 'NewPassword123!',
					userAdapter: mockUserAdapter,
				}),
			).rejects.toThrow('User ID and new password are required');
		});

		it('should throw error for missing newPassword', async () => {
			await expect(
				provider.updatePassword({
					userId: 'user-123',
					newPassword: '',
					userAdapter: mockUserAdapter,
				}),
			).rejects.toThrow('User ID and new password are required');
		});

		it('should validate new password with custom validator', async () => {
			const customValidator = vi.fn(() => ({
				valid: false,
				errors: ['Password too weak'],
			}));

			const customProvider = new CredentialsProvider({
				validatePassword: customValidator,
			});

			await expect(
				customProvider.updatePassword({
					userId: 'user-123',
					newPassword: 'weak',
					userAdapter: mockUserAdapter,
				}),
			).rejects.toThrow('Password too weak');
		});
	});

	describe('changePassword', () => {
		it('should change password after verifying current password', async () => {
			const email = 'test@example.com';
			const currentPassword = 'CurrentPassword123!';
			const newPassword = 'NewPassword123!';
			const currentHash = await hashPassword(currentPassword);

			// Mock authenticate to succeed
			mockUserAdapter.getUserWithPasswordHash.mockResolvedValue({
				id: 'user-123',
				email,
				password: currentHash,
			});

			mockUserAdapter.getUserByEmail.mockResolvedValue({
				id: 'user-123',
				email,
			});

			// Mock updateUser
			mockUserAdapter.updateUser.mockResolvedValue({
				id: 'user-123',
				email,
			});

			const result = await provider.changePassword({
				email,
				currentPassword,
				newPassword,
				userAdapter: mockUserAdapter,
			});

			expect(result.valid).toBe(true);
			expect(result.user).toBeDefined();
			if (!result.user) throw new Error('Expected user');
			expect(result.user.id).toBe('user-123');
			expect(mockUserAdapter.updateUser).toHaveBeenCalledWith(
				'user-123',
				expect.objectContaining({
					password: expect.stringMatching(/^\$argon2id\$/),
				}),
			);
		});

		it('should reject password change with incorrect current password', async () => {
			const email = 'test@example.com';
			const currentPassword = 'CorrectPassword123!';
			const wrongPassword = 'WrongPassword123!';
			const newPassword = 'NewPassword123!';
			const currentHash = await hashPassword(currentPassword);

			mockUserAdapter.getUserWithPasswordHash.mockResolvedValue({
				id: 'user-123',
				email,
				password: currentHash,
			});

			const result = await provider.changePassword({
				email,
				currentPassword: wrongPassword,
				newPassword,
				userAdapter: mockUserAdapter,
			});

			expect(result.valid).toBe(false);
			expect(result.user).toBeNull();
			expect(mockUserAdapter.updateUser).not.toHaveBeenCalled();
		});

		it('should reject password change for non-existent user', async () => {
			mockUserAdapter.getUserWithPasswordHash.mockResolvedValue(null);

			const result = await provider.changePassword({
				email: 'nonexistent@example.com',
				currentPassword: 'CurrentPassword123!',
				newPassword: 'NewPassword123!',
				userAdapter: mockUserAdapter,
			});

			expect(result.valid).toBe(false);
			expect(result.user).toBeNull();
			expect(mockUserAdapter.updateUser).not.toHaveBeenCalled();
		});
	});

	describe('integration scenarios', () => {
		it('should complete full signup and signin flow', async () => {
			const email = 'integration@example.com';
			const password = 'IntegrationTest123!';

			// 1. Sign up
			mockUserAdapter.createUser.mockResolvedValue({
				id: 'user-int',
				email,
				name: 'Integration User',
			});

			const signedUpUser = await provider.signUp({
				email,
				password,
				name: 'Integration User',
				userAdapter: mockUserAdapter,
			});

			expect(signedUpUser.id).toBe('user-int');

			// 2. Authenticate (simulate signin)
			const hashedPassword = await hashPassword(password);
			mockUserAdapter.getUserWithPasswordHash.mockResolvedValue({
				id: 'user-int',
				email,
				password: hashedPassword,
			});

			mockUserAdapter.getUserByEmail.mockResolvedValue({
				id: 'user-int',
				email,
				name: 'Integration User',
			});

			const authResult = await provider.authenticate({
				email,
				password,
				userAdapter: mockUserAdapter,
			});

			expect(authResult.valid).toBe(true);
			if (!authResult.user) throw new Error('Expected user');
			expect(authResult.user.id).toBe('user-int');
		});

		it('should complete full password change flow', async () => {
			const email = 'change@example.com';
			const oldPassword = 'OldPassword123!';
			const newPassword = 'NewPassword123!';
			const oldHash = await hashPassword(oldPassword);
			const newHash = await hashPassword(newPassword);

			// 1. Initial state: user has old password
			mockUserAdapter.getUserWithPasswordHash.mockResolvedValue({
				id: 'user-change',
				email,
				password: oldHash,
			});

			mockUserAdapter.getUserByEmail.mockResolvedValue({
				id: 'user-change',
				email,
			});

			mockUserAdapter.updateUser.mockResolvedValue({
				id: 'user-change',
				email,
			});

			// 2. Change password (verify current, set new)
			const changeResult = await provider.changePassword({
				email,
				currentPassword: oldPassword,
				newPassword,
				userAdapter: mockUserAdapter,
			});

			expect(changeResult.valid).toBe(true);

			// 3. After password change, mock should return new hash
			mockUserAdapter.getUserWithPasswordHash.mockResolvedValue({
				id: 'user-change',
				email,
				password: newHash, // Now has new password
			});

			// 4. Verify old password no longer works
			const oldAuthResult = await provider.authenticate({
				email,
				password: oldPassword,
				userAdapter: mockUserAdapter,
			});

			expect(oldAuthResult.valid).toBe(false);

			// 5. Verify new password works
			const newAuthResult = await provider.authenticate({
				email,
				password: newPassword,
				userAdapter: mockUserAdapter,
			});

			expect(newAuthResult.valid).toBe(true);
		});
	});
});
