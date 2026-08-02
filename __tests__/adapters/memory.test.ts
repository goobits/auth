import { describe, expect, it } from 'vitest'

import {
	createMemoryAuthAdapters,
	MemoryMagicLinkAdapter,
	MemoryMfaAdapter,
	MemoryUserAdapter,
	MemoryWebAuthnAdapter
} from '../../src/adapters/memory/index.ts'

describe('memory auth adapters', () => {
	it('create users, sessions, and validate session principals', async () => {
		const adapters = createMemoryAuthAdapters({
			cookieName: 'auth',
			secureCookies: false,
			sessionLifetimeMs: 60_000
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
		expect(session.expiresAt.getTime() - Date.now()).toBeGreaterThan(59_000)
		expect(session.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(60_000)
		await expect(adapters.session.validateSession(session.id)).resolves.toMatchObject({
			session: { id: session.id }
		})
	})

	it('rejects unknown and oversized session metadata', async () => {
		const adapters = createMemoryAuthAdapters({ cookieName: 'auth', secureCookies: false })
		await expect(
			adapters.session.createSession('user-1', { id: 'override' } as never)
		).rejects.toThrow('Unsupported session metadata field')
		await expect(
			adapters.session.createSession('user-1', { userAgent: 'x'.repeat(513) })
		).rejects.toThrow('at most 512')
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

	it('keeps one immutable owner for each OAuth provider identity', async () => {
		const adapter = new MemoryUserAdapter()
		adapter.setUser({
			avatar: null,
			email: 'owner@example.com',
			emailVerified: true,
			id: 'owner-1',
			name: 'Owner'
		})

		const identity = { userId: 'owner-1', provider: 'google', subject: 'provider-1' }
		await expect(adapter.linkIdentity(identity)).resolves.toBeUndefined()
		await expect(adapter.linkIdentity(identity)).resolves.toBeUndefined()
		await expect(adapter.linkIdentity({ ...identity, userId: 'owner-2' })).rejects.toThrow(
			'already linked'
		)
		await expect(adapter.getIdentity('google', 'provider-1')).resolves.toEqual(identity)
		await expect(adapter.listIdentities('owner-1')).resolves.toEqual([identity])
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

	it('rejects invalid and regressing WebAuthn counters', async () => {
		const adapter = new MemoryWebAuthnAdapter()
		await expect(
			adapter.createCredential({
				userId: 'user-1',
				credentialId: 'credential-invalid',
				publicKey: 'public-key',
				counter: -1
			})
		).rejects.toThrow('non-negative safe integer')

		await expect(
			adapter.createCredential({
				userId: 'user-1',
				credentialId: 'credential-1',
				publicKey: 'public-key',
				counter: 0
			})
		).resolves.toBe(true)
		await expect(
			adapter.advanceCredentialCounter({
				credentialId: 'credential-1',
				userId: 'user-1',
				expectedCounter: 0,
				newCounter: 0
			})
		).resolves.toBe(true)
		await expect(
			adapter.advanceCredentialCounter({
				credentialId: 'credential-1',
				userId: 'user-1',
				expectedCounter: 0,
				newCounter: 1
			})
		).resolves.toBe(true)
		await expect(
			adapter.advanceCredentialCounter({
				credentialId: 'credential-1',
				userId: 'user-1',
				expectedCounter: 1,
				newCounter: 1
			})
		).rejects.toThrow('advance monotonically')
		await expect(
			adapter.deleteCredential({ credentialId: 'credential-1', userId: 'attacker' })
		).resolves.toBe(false)
		await expect(
			adapter.deleteCredential({ credentialId: 'credential-1', userId: 'user-1' })
		).resolves.toBe(true)
	})

	it('removes only expired in-memory WebAuthn challenges', async () => {
		const adapter = new MemoryWebAuthnAdapter()
		await adapter.createChallenge({
			challengeId: 'expired',
			userId: null,
			challenge: 'expired',
			type: 'authentication',
			expiresAt: new Date(0)
		})
		await adapter.createChallenge({
			challengeId: 'active',
			userId: null,
			challenge: 'active',
			type: 'authentication',
			expiresAt: new Date('2099-01-01T00:00:00.000Z')
		})

		await expect(adapter.deleteExpiredChallenges(new Date())).resolves.toBe(1)
		await expect(adapter.getChallenge('expired')).resolves.toBeNull()
		await expect(adapter.getChallenge('active')).resolves.not.toBeNull()
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
