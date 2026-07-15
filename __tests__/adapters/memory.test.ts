import { describe, expect, it } from 'vitest'

import {
	createMemoryAuthAdapters,
	MemoryMagicLinkAdapter,
	MemoryMfaAdapter,
	MemoryUserAdapter
} from '../../src/adapters/memory/index.ts'

describe('memory auth adapters', () => {
	it('create users, sessions, and validate session principals', async () => {
		const adapters = createMemoryAuthAdapters({
			cookieName: 'auth',
			secureCookies: false
		})
		const publicCapabilityHasCredentialReader: 'findPasswordCredential' extends keyof typeof adapters.user
			? true
			: false = false
		const credentialCapabilityHasProfileReader: 'getUserByEmail' extends keyof typeof adapters.passwordCredential
			? true
			: false = false
		const user = await adapters.user.createUser({
			email: 'dev@example.com',
			id: 'dev-user',
			name: 'Dev User',
			verified_email: true
		})
		const session = await adapters.session.createSession(user.id, {
			ip: '127.0.0.1',
			userAgent: 'vitest'
		})

		const result = await adapters.session.validateSession(session.id)
		expect(publicCapabilityHasCredentialReader).toBe(false)
		expect(credentialCapabilityHasProfileReader).toBe(false)
		expect(result.user?.id).toBe('dev-user')
		expect(result.session?.ip).toBe('127.0.0.1')
	})

	it('stores explicit test users without password leakage', async () => {
		const adapter = new MemoryUserAdapter()
		adapter.setUser({
			avatar: null,
			email: 'test@example.com',
			emailVerified: false,
			id: 'test-user',
			name: 'Test User',
			password: 'secret'
		})

		expect(await adapter.findPasswordCredential('test@example.com')).toMatchObject({
			passwordHash: 'secret'
		})
		expect(await adapter.getUserByEmail('test@example.com')).not.toHaveProperty('password')
		await expect(adapter.updateUser('test-user', { password: 'replacement' })).rejects.toThrow(
			/updatePasswordHash/
		)
		await expect(
			adapter.updateUser('test-user', { settings: { refreshToken: 'private' } })
		).rejects.toThrow(/dedicated auth capability/)
	})

	it('stores and consumes magic link tokens atomically', async () => {
		const adapter = new MemoryMagicLinkAdapter()
		await adapter.createToken({
			userId: null,
			email: 'dev@example.com',
			tokenHash: 'token-hash',
			otpHash: 'otp-hash',
			expiresAt: new Date(Date.now() + 60_000),
			metadata: { grantId: 'grant-1' }
		})

		await expect(adapter.findByTokenHash('token-hash')).resolves.toMatchObject({
			email: 'dev@example.com',
			metadata: { grantId: 'grant-1' }
		})
		await expect(adapter.consumeByTokenHash('token-hash')).resolves.toMatchObject({
			email: 'dev@example.com'
		})
		await expect(adapter.consumeByTokenHash('token-hash')).resolves.toBeNull()
	})

	it('keeps active MFA factors immutable and backup codes single-use', async () => {
		const adapter = new MemoryMfaAdapter()

		await expect(adapter.beginEnrollment('user-1', 'secret-1', ['hash-1'])).resolves.toBe(true)
		await expect(adapter.activateEnrollment('user-1')).resolves.toBe(true)
		await expect(adapter.beginEnrollment('user-1', 'secret-2', ['hash-2'])).resolves.toBe(false)
		await expect(adapter.getSecret('user-1')).resolves.toBe('secret-1')
		await expect(adapter.consumeBackupCode('user-1', 'hash-1')).resolves.toBe(true)
		await expect(adapter.consumeBackupCode('user-1', 'hash-1')).resolves.toBe(false)
	})
})
