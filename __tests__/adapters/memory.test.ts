import { describe, expect, it } from 'vitest'

import {
	createMemoryAuthAdapters,
	MemoryMagicLinkAdapter,
	MemoryUserAdapter
} from '../../src/adapters/memory/index.ts'

describe('memory auth adapters', () => {
	it('create users, sessions, and validate session principals', async() => {
		const adapters = createMemoryAuthAdapters({
			cookieName: 'auth',
			secureCookies: false
		})
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
		expect(result.user?.id).toBe('dev-user')
		expect(result.session?.ip).toBe('127.0.0.1')
	})

	it('stores explicit test users without password leakage', async() => {
		const adapter = new MemoryUserAdapter()
		adapter.setUser({
			avatar: null,
			email: 'test@example.com',
			emailVerified: false,
			id: 'test-user',
			name: 'Test User',
			password: 'secret'
		})

		expect(await adapter.getUserWithPasswordHash('test@example.com')).toMatchObject({
			password: 'secret'
		})
		expect(await adapter.getUserByEmail('test@example.com')).not.toHaveProperty('password')
	})

	it('stores and consumes magic link tokens atomically', async() => {
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
})
