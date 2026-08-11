import { describe, expect, it } from 'vitest'

import {
	createPgAuthAdapters,
	pgAuthSchemaSql,
	type PgPoolLike
} from '../../src/adapters/pg/index.ts'
import { mfaSecretCodec } from './_pgTestKit.ts'

describe('pg auth adapters', () => {
	it('exposes the default postgres schema', () => {
		expect(pgAuthSchemaSql).toContain('CREATE TABLE IF NOT EXISTS auth_users')
		expect(pgAuthSchemaSql).toContain('CREATE TABLE IF NOT EXISTS auth_sessions')
		expect(pgAuthSchemaSql).toContain('CREATE TABLE IF NOT EXISTS auth_verification_tokens')
		expect(pgAuthSchemaSql).toContain(
			'CREATE UNIQUE INDEX IF NOT EXISTS auth_verification_tokens_user_type_idx'
		)
		expect(pgAuthSchemaSql).toContain(
			'ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS mfa_verified_at'
		)
		expect(pgAuthSchemaSql).toContain('CREATE TABLE IF NOT EXISTS auth_oauth_accounts')
		expect(pgAuthSchemaSql).toContain(
			'CREATE UNIQUE INDEX IF NOT EXISTS auth_oauth_accounts_user_provider_idx'
		)
		expect(pgAuthSchemaSql).toContain('CREATE TABLE IF NOT EXISTS auth_mfa_factors')
		expect(pgAuthSchemaSql).toContain(
			'ALTER TABLE auth_mfa_factors ADD COLUMN IF NOT EXISTS last_used_counter BIGINT'
		)
		expect(pgAuthSchemaSql).toContain('CREATE TABLE IF NOT EXISTS auth_mfa_backup_codes')
		expect(pgAuthSchemaSql).toContain('CREATE TABLE IF NOT EXISTS auth_webauthn_challenges')
		expect(pgAuthSchemaSql).toContain('CREATE TABLE IF NOT EXISTS auth_webauthn_credentials')
		expect(pgAuthSchemaSql).toContain('CREATE TABLE IF NOT EXISTS auth_magic_link_tokens')
	})

	it('keeps postgres password hashes behind the credential capability', async () => {
		let password = 'encoded-one'
		const userRow = () => ({
			avatar: null,
			created_at: new Date('2026-01-01T00:00:00.000Z'),
			email: 'credential@example.com',
			email_verified: false,
			id: 'credential-user',
			name: 'Credential User',
			password,
			role: null,
			settings: {},
			updated_at: new Date('2026-01-01T00:00:00.000Z')
		})
		const db: PgPoolLike = {
			async query(text, values = []) {
				if (text.includes('INSERT INTO auth_users')) {
					password = String(values[7])
					return { rows: [userRow()] }
				}
				if (text.includes('UPDATE auth_users SET password')) {
					password = String(values[1])
					return { rows: [userRow()] }
				}
				if (text.includes('SELECT * FROM auth_users WHERE email')) {
					return { rows: [userRow()] }
				}
				throw new Error(`Unexpected query: ${text}`)
			}
		}
		const adapters = createPgAuthAdapters({
			cookieName: 'auth',
			db,
			mfaSecretCodec,
			secureCookies: true
		})

		const profile = await adapters.passwordCredential.createUserWithPassword(
			{ email: 'credential@example.com', name: 'Credential User' },
			'encoded-one'
		)
		expect(profile).not.toHaveProperty('password')
		await expect(
			adapters.passwordCredential.findPasswordCredential(profile.email)
		).resolves.toEqual({ user: profile, passwordHash: 'encoded-one' })
		await adapters.passwordCredential.updatePasswordHash(profile.id, 'encoded-two')
		await expect(
			adapters.passwordCredential.findPasswordCredential(profile.email)
		).resolves.toMatchObject({ passwordHash: 'encoded-two' })
		await expect(adapters.user.updateUser(profile.id, { password: 'bypass' })).rejects.toThrow(
			/updatePasswordHash/
		)
	})

	it('never turns OAuth user creation into an update of an existing email owner', async () => {
		let insertSql = ''
		const db: PgPoolLike = {
			async query(text) {
				if (text.includes('INSERT INTO auth_users')) {
					insertSql = text
					return { rows: [] }
				}
				throw new Error(`Unexpected query: ${text}`)
			}
		}
		const adapters = createPgAuthAdapters({
			cookieName: 'auth',
			db,
			mfaSecretCodec,
			secureCookies: true
		})

		await expect(
			adapters.user.createUser({
				id: 'provider-user',
				email: 'existing@example.com',
				verified_email: false
			})
		).rejects.toThrow('Unable to create OAuth user')
		expect(insertSql).toContain('ON CONFLICT (email) DO NOTHING')
		expect(insertSql).not.toContain('DO UPDATE')
	})

	it('never reassigns an existing PostgreSQL OAuth identity', async () => {
		const db: PgPoolLike = {
			async query(text) {
				if (text.includes('SELECT provider, provider_account_id')) {
					return { rows: [] }
				}
				if (text.includes('INSERT INTO auth_oauth_accounts')) {
					return { rows: [{ user_id: 'owner-1' }] }
				}
				throw new Error(`Unexpected query: ${text}`)
			}
		}
		const adapters = createPgAuthAdapters({
			cookieName: 'auth',
			db,
			mfaSecretCodec,
			secureCookies: true
		})

		await expect(
			adapters.oauthIdentity.linkIdentity({
				userId: 'owner-1',
				provider: 'google',
				subject: 'provider-1'
			})
		).resolves.toBeUndefined()
		await expect(
			adapters.oauthIdentity.linkIdentity({
				userId: 'owner-2',
				provider: 'google',
				subject: 'provider-1'
			})
		).rejects.toThrow('already linked')
	})

	it('atomically consumes postgres verification tokens', async () => {
		let tokenRow: Record<string, unknown> | null = null
		let replacementWasAtomic = false
		const userRow = {
			avatar: null,
			created_at: new Date('2026-01-01T00:00:00.000Z'),
			email: 'owner@example.com',
			email_verified: true,
			id: 'owner',
			name: 'Owner',
			password: null,
			role: null,
			settings: {},
			updated_at: new Date('2026-01-01T00:00:00.000Z')
		}
		const db: PgPoolLike = {
			async query(text, values = []) {
				if (text.includes('INSERT INTO auth_verification_tokens')) {
					replacementWasAtomic = text.includes('ON CONFLICT (user_id, type) DO UPDATE')
					tokenRow = {
						created_at: new Date('2026-01-01T00:00:00.000Z'),
						expires_at: values[4],
						id: values[0],
						metadata: JSON.parse(String(values[5])),
						token: values[3],
						type: values[2],
						user_id: values[1]
					}
					return { rows: [] }
				}
				if (text.includes('DELETE FROM auth_verification_tokens') && text.includes('RETURNING')) {
					const consumed = tokenRow
					if (consumed && consumed['token'] === values[0] && consumed['type'] === values[1]) {
						tokenRow = null
						return { rows: [consumed] }
					}
					return { rows: [] }
				}
				if (text.includes('SELECT * FROM auth_users WHERE id')) {
					return { rows: [userRow] }
				}
				throw new Error(`Unexpected query: ${text}`)
			}
		}
		const adapters = createPgAuthAdapters({
			cookieName: 'auth',
			db,
			mfaSecretCodec,
			secureCookies: true
		})
		await adapters.verificationToken.replaceForUserAndType({
			userId: 'owner',
			type: 'password_reset',
			token: 'hashed-token',
			expiresAt: new Date('2099-01-01T00:00:00.000Z'),
			metadata: { requestId: 'request-1' }
		})
		expect(replacementWasAtomic).toBe(true)

		await expect(
			adapters.verificationToken.consumeByToken({
				token: 'hashed-token',
				type: 'password_reset'
			})
		).resolves.toMatchObject({
			token: { metadata: { requestId: 'request-1' } },
			user: { id: 'owner' }
		})
		await expect(
			adapters.verificationToken.consumeByToken({
				token: 'hashed-token',
				type: 'password_reset'
			})
		).resolves.toBeNull()
	})
})
