import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PasswordCredentialAdapter } from '../../src/adapters/database/PasswordCredentialAdapter.ts'
import { MAX_PASSWORD_LENGTH } from '../../src/password/index.ts'
import { CredentialsProvider } from '../../src/providers/CredentialsProvider.ts'

const user = {
	id: 'user-123',
	email: 'test@example.com',
	name: 'Test User',
	avatar: null,
	emailVerified: false
}

describe('CredentialsProvider', () => {
	let provider: CredentialsProvider
	let passwordCredentialAdapter: PasswordCredentialAdapter
	let findPasswordCredential: ReturnType<typeof vi.fn>
	let createUserWithPassword: ReturnType<typeof vi.fn>
	let updatePasswordHash: ReturnType<typeof vi.fn>
	const hashPassword = vi.fn(async (password: string) => `test:${password}`)
	const verifyPassword = vi.fn(async (storedHash: string, password: string) => {
		return storedHash === `test:${password}`
	})

	beforeEach(() => {
		vi.clearAllMocks()
		findPasswordCredential = vi.fn()
		createUserWithPassword = vi.fn()
		updatePasswordHash = vi.fn()
		passwordCredentialAdapter = {
			findPasswordCredential,
			createUserWithPassword,
			updatePasswordHash
		} as unknown as PasswordCredentialAdapter
		provider = new CredentialsProvider({ hashPassword, verifyPassword })
	})

	it('authenticates through the secret-bearing adapter and returns its sanitized user', async () => {
		findPasswordCredential.mockResolvedValue({ user, passwordHash: 'test:correct' })

		await expect(
			provider.authenticate({
				email: ' Test@Example.com ',
				password: 'correct',
				passwordCredentialAdapter
			})
		).resolves.toEqual({ user, valid: true })
		expect(findPasswordCredential).toHaveBeenCalledWith('test@example.com', 'email')
		expect(user).not.toHaveProperty('password')
	})

	it('rejects invalid, missing, passwordless, and oversized credentials', async () => {
		findPasswordCredential.mockResolvedValue({ user, passwordHash: 'test:correct' })
		await expect(
			provider.authenticate({
				email: user.email,
				password: 'wrong',
				passwordCredentialAdapter
			})
		).resolves.toEqual({ user: null, valid: false })

		findPasswordCredential.mockResolvedValue({ user, passwordHash: null })
		await expect(
			provider.authenticate({
				email: user.email,
				password: 'correct',
				passwordCredentialAdapter
			})
		).resolves.toEqual({ user: null, valid: false })

		findPasswordCredential.mockClear()
		await expect(
			provider.authenticate({
				email: user.email,
				password: 'x'.repeat(MAX_PASSWORD_LENGTH + 1),
				passwordCredentialAdapter
			})
		).resolves.toEqual({ user: null, valid: false })
		expect(findPasswordCredential).not.toHaveBeenCalled()
	})

	it('performs one dummy verification when no password credential exists', async () => {
		findPasswordCredential.mockResolvedValue(null)
		const hardened = new CredentialsProvider({
			dummyPasswordHash: 'test:sentinel',
			hashPassword,
			verifyPassword
		})

		await hardened.authenticate({
			email: 'missing@example.com',
			password: 'attempt',
			passwordCredentialAdapter
		})

		expect(verifyPassword).toHaveBeenCalledOnce()
		expect(verifyPassword).toHaveBeenCalledWith('test:sentinel', 'attempt')
	})

	it('derives and reuses a compatible dummy hash when one is not configured', async () => {
		findPasswordCredential.mockResolvedValue(null)

		await provider.authenticate({
			email: 'first-missing@example.com',
			password: 'attempt-one',
			passwordCredentialAdapter
		})
		await provider.authenticate({
			email: 'second-missing@example.com',
			password: 'attempt-two',
			passwordCredentialAdapter
		})

		expect(hashPassword).toHaveBeenCalledOnce()
		const dummyInput = hashPassword.mock.calls[0]?.[0]
		expect(dummyInput).toEqual(expect.any(String))
		expect(verifyPassword).toHaveBeenNthCalledWith(1, `test:${dummyInput}`, 'attempt-one')
		expect(verifyPassword).toHaveBeenNthCalledWith(2, `test:${dummyInput}`, 'attempt-two')
	})

	it('supports explicit identifier lookup with optional email fallback', async () => {
		const usernameProvider = provider.withIdentifier('username', { allowBoth: true })
		findPasswordCredential
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce({ user, passwordHash: 'test:correct' })

		await expect(
			usernameProvider.authenticate({
				identifier: ' TEST@EXAMPLE.COM ',
				password: 'correct',
				passwordCredentialAdapter
			})
		).resolves.toEqual({ user, valid: true })
		expect(findPasswordCredential).toHaveBeenNthCalledWith(1, 'test@example.com', 'username')
		expect(findPasswordCredential).toHaveBeenNthCalledWith(2, 'test@example.com', 'email')
	})

	it('upgrades an accepted legacy hash only through the password adapter', async () => {
		const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
		const upgradeProvider = new CredentialsProvider({
			hashPassword,
			logger,
			verifyPassword: vi.fn(async () => ({ valid: true, needsRehash: true }))
		})
		findPasswordCredential.mockResolvedValue({ user, passwordHash: 'legacy' })
		updatePasswordHash.mockResolvedValue(user)

		await expect(
			upgradeProvider.authenticate({
				email: user.email,
				password: 'correct',
				passwordCredentialAdapter
			})
		).resolves.toEqual({ user, valid: true })
		expect(updatePasswordHash).toHaveBeenCalledWith(user.id, 'test:correct')
		expect(logger.error).not.toHaveBeenCalled()
	})

	it('does not block login when opportunistic rehash persistence fails', async () => {
		const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
		const upgradeProvider = new CredentialsProvider({
			hashPassword,
			logger,
			verifyPassword: vi.fn(async () => ({ valid: true, needsRehash: true }))
		})
		findPasswordCredential.mockResolvedValue({ user, passwordHash: 'legacy' })
		updatePasswordHash.mockRejectedValue(new Error('storage unavailable'))

		await expect(
			upgradeProvider.authenticate({
				email: user.email,
				password: 'correct',
				passwordCredentialAdapter
			})
		).resolves.toEqual({ user, valid: true })
		expect(logger.error).toHaveBeenCalledWith(
			'[CredentialsProvider] Failed to upgrade password hash',
			{ errorType: 'Error' }
		)
	})

	it('creates users without placing password material in general metadata', async () => {
		createUserWithPassword.mockResolvedValue(user)

		await provider.signUp({
			email: 'Test@Example.com',
			password: 'new-password',
			metadata: {
				password: 'attacker',
				passwordHash: 'attacker-hash',
				provider: 'admin',
				role: 'member',
				settings: { refreshToken: 'attacker-token', theme: 'dark' }
			},
			passwordCredentialAdapter
		})

		expect(createUserWithPassword).toHaveBeenCalledWith(
			expect.objectContaining({ email: 'test@example.com', verified_email: false }),
			'test:new-password',
			{
				provider: 'email',
				emailVerified: false,
				role: 'member',
				settings: { theme: 'dark' }
			}
		)
	})

	it('updates and changes passwords through updatePasswordHash', async () => {
		updatePasswordHash.mockResolvedValue(user)
		await expect(
			provider.updatePassword({
				userId: user.id,
				newPassword: 'updated',
				passwordCredentialAdapter
			})
		).resolves.toEqual(user)
		expect(updatePasswordHash).toHaveBeenCalledWith(user.id, 'test:updated')

		findPasswordCredential.mockResolvedValue({ user, passwordHash: 'test:current' })
		await expect(
			provider.changePassword({
				email: user.email,
				currentPassword: 'current',
				newPassword: 'next',
				passwordCredentialAdapter
			})
		).resolves.toEqual({ user, valid: true })
		expect(updatePasswordHash).toHaveBeenLastCalledWith(user.id, 'test:next')
	})

	it('validates new passwords before persistence', async () => {
		const rejectingProvider = new CredentialsProvider({
			hashPassword,
			validatePassword: () => ({ valid: false, errors: ['Password too weak'] }),
			verifyPassword
		})

		await expect(
			rejectingProvider.updatePassword({
				userId: user.id,
				newPassword: 'weak',
				passwordCredentialAdapter
			})
		).rejects.toThrow('Password too weak')
		expect(updatePasswordHash).not.toHaveBeenCalled()
	})
})
