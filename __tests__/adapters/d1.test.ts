import { describe, expect, it } from 'vitest'

import { D1UserAdapter } from '../../src/adapters/database/D1UserAdapter.ts'
import { D1MagicLinkAdapter } from '../../src/adapters/magic-link/D1MagicLinkAdapter.ts'
import { D1TokenAdapter } from '../../src/adapters/oauth-token/D1TokenAdapter.ts'
import { D1SessionAdapter } from '../../src/adapters/session/D1SessionAdapter.ts'
import { D1VerificationTokenAdapter } from '../../src/adapters/verification-token/D1VerificationTokenAdapter.ts'
import { D1WebAuthnAdapter } from '../../src/adapters/webauthn/D1WebAuthnAdapter.ts'
import { createMockDb } from './_d1TestKit.ts'

describe('D1 adapters', () => {
	it('creates user and session and validates', async () => {
		const db = createMockDb()
		const userAdapter = new D1UserAdapter(db)
		const sessionAdapter = new D1SessionAdapter(db, {
			sessionLifetime: 1000,
			sessionRefreshThreshold: 500,
			columns: { mfaVerifiedAt: 'mfa_verified_at' }
		})

		const user = await userAdapter.createUser({ email: 'a@b.com', name: 'A', verified_email: true })
		const mfaVerifiedAt = new Date('2026-07-14T12:00:00.000Z')
		const session = await sessionAdapter.createSession(user.id, { mfaVerifiedAt })
		const result = await sessionAdapter.validateSession(session.id)
		expect(result.user?.email).toBe('a@b.com')
		expect(result.session?.id).toBe(session.id)
		expect(result.session?.mfaVerifiedAt).toEqual(mfaVerifiedAt)
		expect(db._tables.sessions[0]?.['id']).not.toBe(session.id)
		await expect(
			sessionAdapter.validateSession(String(db._tables.sessions[0]?.['id']))
		).resolves.toEqual({ session: null, user: null })
	})

	it('round-trips D1 session timestamps and request metadata when configured', async () => {
		const db = createMockDb()
		const userAdapter = new D1UserAdapter(db)
		const sessionAdapter = new D1SessionAdapter(db, {
			columns: {
				createdAt: 'created_at',
				lastActiveAt: 'last_active_at',
				ip: 'ip',
				userAgent: 'user_agent'
			}
		})
		const user = await userAdapter.createUser({
			email: 'session@example.com',
			name: 'Session User'
		})
		const createdAt = new Date('2026-07-15T10:00:00.000Z')
		const session = await sessionAdapter.createSession(user.id, {
			createdAt,
			ip: '192.0.2.10',
			userAgent: 'Test Browser'
		})
		const validated = await sessionAdapter.validateSession(session.id)

		expect(validated.session).toMatchObject({
			createdAt,
			lastActiveAt: createdAt,
			ip: '192.0.2.10',
			userAgent: 'Test Browser'
		})
		expect(db._tables.sessions[0]).toMatchObject({
			created_at: createdAt.toISOString(),
			ip: '192.0.2.10',
			user_agent: 'Test Browser'
		})
	})

	it('round-trips Unix-second assurance timestamps and non-secret management handles', async () => {
		const db = createMockDb()
		const userAdapter = new D1UserAdapter(db)
		const sessionAdapter = new D1SessionAdapter(db, {
			timestampFormat: 'unix-seconds',
			columns: {
				managementId: 'management_id',
				createdAt: 'created_at',
				lastActiveAt: 'last_active_at',
				mfaVerifiedAt: 'mfa_verified_at'
			}
		})
		const user = await userAdapter.createUser({
			email: 'assurance@example.com',
			name: 'Assurance User'
		})
		const createdAt = new Date('2026-07-15T10:00:00.000Z')
		const mfaVerifiedAt = new Date('2026-07-15T10:05:00.000Z')
		const session = await sessionAdapter.createSession(user.id, { createdAt, mfaVerifiedAt })
		const validated = await sessionAdapter.validateSession(session.id)
		const managed = await sessionAdapter.listManagedSessions(user.id)

		expect(validated.session).toMatchObject({
			createdAt,
			lastActiveAt: createdAt,
			mfaVerifiedAt,
			managementId: session.managementId
		})
		expect(managed).toEqual([
			expect.objectContaining({ id: session.managementId, userId: user.id })
		])
		expect(managed[0]?.id).not.toBe(session.id)

		await sessionAdapter.revokeManagedSession(user.id, managed[0]?.id ?? '')
		await expect(sessionAdapter.validateSession(session.id)).resolves.toEqual({
			session: null,
			user: null
		})
	})

	it('keeps D1 password hashes behind the credential capability', async () => {
		const adapter = new D1UserAdapter(createMockDb())
		const profile = await adapter.createUserWithPassword(
			{ email: 'credential@example.com', name: 'Credential User' },
			'encoded-one'
		)

		expect(profile).not.toHaveProperty('password')
		await expect(adapter.findPasswordCredential(profile.email)).resolves.toEqual({
			user: profile,
			passwordHash: 'encoded-one'
		})
		await adapter.updatePasswordHash(profile.id, 'encoded-two')
		await expect(adapter.findPasswordCredential(profile.email)).resolves.toMatchObject({
			passwordHash: 'encoded-two'
		})
		await expect(adapter.updateUser(profile.id, { password: 'bypass' })).rejects.toThrow(
			/updatePasswordHash/
		)
	})

	it('stores and retrieves oauth tokens', async () => {
		const db = createMockDb()
		const tokenAdapter = new D1TokenAdapter(db, {
			encryptionKeyringJson: JSON.stringify({
				activeKeyId: 'current',
				keys: { current: 'a'.repeat(64) }
			})
		})
		await tokenAdapter.storeTokens('1', 'google', {
			accessToken: 'x',
			refreshToken: null,
			scope: null,
			accessTokenExpiresAt: new Date().toISOString()
		})
		const tokens = await tokenAdapter.getTokens('1', 'google')
		expect(tokens?.accessToken).toBe('x')
		await tokenAdapter.storeTokens('1', 'google', {
			accessToken: 'rotated',
			refreshToken: null,
			scope: null,
			accessTokenExpiresAt: new Date().toISOString()
		})
		await expect(tokenAdapter.getTokens('1', 'google')).resolves.toMatchObject({
			accessToken: 'rotated'
		})
	})

	it('rejects unsafe OAuth token table identifiers', () => {
		expect(
			() =>
				new D1TokenAdapter(createMockDb(), {
					tokensTable: 'oauth_tokens; DROP TABLE users',
					encryptionKeyringJson: JSON.stringify({
						activeKeyId: 'current',
						keys: { current: 'a'.repeat(64) }
					})
				})
		).toThrow(/invalid D1 SQL identifier/)
	})

	it('rejects unsafe identifiers consistently across every D1 adapter family', () => {
		const db = createMockDb()
		const unsafe = 'records; DROP TABLE users'
		const factories = [
			() => new D1UserAdapter(db, { usersTable: unsafe }),
			() => new D1SessionAdapter(db, { sessionsTable: unsafe }),
			() => new D1MagicLinkAdapter(db as never, { tokensTable: unsafe }),
			() => new D1VerificationTokenAdapter(db as never, { tokensTable: unsafe }),
			() => new D1WebAuthnAdapter(db as never, { credentialsTable: unsafe })
		]

		for (const createAdapter of factories) {
			expect(createAdapter).toThrow(/invalid D1 SQL identifier/)
		}
	})
})
