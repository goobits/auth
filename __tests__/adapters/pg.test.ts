import { describe, expect, it } from 'vitest'

import {
	createPgAuthAdapters,
	pgAuthSchemaSql,
	type MfaSecretCodec,
	type PgPoolLike
} from '../../src/adapters/pg/index.ts'

const mfaSecretCodec: MfaSecretCodec = {
	async encrypt(secret, userId) {
		return `test-seal:${userId}:${[...secret].reverse().join('')}`
	},
	async decrypt(ciphertext, userId) {
		const prefix = `test-seal:${userId}:`
		if (!ciphertext.startsWith(prefix)) throw new Error('Invalid test MFA ciphertext')
		return [...ciphertext.slice(prefix.length)].reverse().join('')
	}
}

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

	it('omits the optional MFA capability when no secret codec is supplied', () => {
		const db: PgPoolLike = { query: async () => ({ rows: [] }) }
		const adapters = createPgAuthAdapters({
			cookieName: 'auth',
			db,
			secureCookies: true
		})

		expect(adapters.mfa).toBeUndefined()
		expect('mfa' in adapters).toBe(false)
	})

	it('creates sessions through a node-postgres compatible pool', async () => {
		let storedSessionId = ''
		const db: PgPoolLike = {
			async query(text, values = []) {
				if (text.includes('INSERT INTO auth_sessions')) {
					storedSessionId = String(values[0])
					return {
						rows: [
							{
								created_at: new Date('2099-01-01T00:00:00.000Z'),
								expires_at: values[2],
								fingerprint: values[5] ?? null,
								id: values[0],
								ip: values[3] ?? null,
								last_active_at: null,
								mfa_verified_at: values[6] ?? null,
								user_agent: values[4] ?? null,
								user_id: values[1]
							}
						]
					}
				}
				throw new Error(`Unexpected query: ${text}`)
			}
		}
		const adapters = createPgAuthAdapters({
			cookieName: 'auth',
			db,
			mfaSecretCodec,
			secureCookies: true,
			sessionLifetimeMs: 60_000
		})

		const mfaVerifiedAt = new Date('2026-07-14T12:00:00.000Z')
		const session = await adapters.session.createSession('user-1', {
			fingerprint: 'fingerprint',
			ip: '127.0.0.1',
			mfaVerifiedAt,
			userAgent: 'vitest'
		})

		expect(session.userId).toBe('user-1')
		expect(session.fingerprint).toBe('fingerprint')
		expect(session.mfaVerifiedAt).toEqual(mfaVerifiedAt)
		expect(session.expiresAt.getTime() - Date.now()).toBeGreaterThan(59_000)
		expect(session.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(60_000)
		expect(storedSessionId).not.toBe(session.id)
	})

	it('creates WebAuthn challenges and credentials through the postgres bundle', async () => {
		const queries: Array<{ text: string; values: readonly unknown[] }> = []
		const db: PgPoolLike = {
			async query(text, values = []) {
				queries.push({ text, values })
				if (text.includes('INSERT INTO auth_webauthn_credentials')) {
					return { rows: [{ credential_id: values[1] }] }
				}
				if (text.includes('SELECT * FROM auth_webauthn_challenges')) {
					return {
						rows: [
							{
								challenge: 'challenge',
								expires_at: new Date('2099-01-01T00:00:00.000Z'),
								id: values[0],
								type: 'registration',
								user_id: 42
							}
						]
					}
				}
				if (text.includes('SELECT * FROM auth_webauthn_credentials WHERE credential_id')) {
					return {
						rows: [
							{
								counter: '4294967295',
								created_at: new Date('2026-01-01T00:00:00.000Z'),
								credential_id: values[0],
								name: 'Work laptop',
								public_key: 'public-key',
								transports: ['internal'],
								updated_at: new Date('2026-01-01T00:00:00.000Z'),
								user_id: 'user-1'
							}
						]
					}
				}
				return { rows: [] }
			}
		}
		const adapters = createPgAuthAdapters({
			cookieName: 'auth',
			db,
			mfaSecretCodec,
			secureCookies: true
		})

		await adapters.webauthn.createChallenge({
			challenge: 'challenge',
			challengeId: 'challenge-1',
			expiresAt: new Date('2099-01-01T00:00:00.000Z'),
			type: 'registration',
			userId: 'user-1'
		})
		await expect(
			adapters.webauthn.createCredential({
				counter: 0,
				credentialId: 'credential-1',
				name: 'Work laptop',
				publicKey: 'public-key',
				transports: ['internal'],
				userId: 'user-1'
			})
		).resolves.toBe(true)
		const challenge = await adapters.webauthn.getChallenge('challenge-1')
		const credential = await adapters.webauthn.getCredential('credential-1')

		expect(challenge?.id).toBe('challenge-1')
		expect(challenge?.userId).toBe('42')
		expect(credential?.counter).toBe(4_294_967_295)
		expect(credential?.transports).toEqual(['internal'])
		expect(
			queries.some((query) => query.text.includes('INSERT INTO auth_webauthn_challenges'))
		).toBe(true)
		expect(
			queries.some((query) => query.text.includes('INSERT INTO auth_webauthn_credentials'))
		).toBe(true)
	})

	it('keeps postgres WebAuthn owners immutable and advances counters with compare-and-swap', async () => {
		const credential = { counter: 0, owner: 'user-1' }
		let inserted = false
		let insertedTransports: unknown
		const db: PgPoolLike = {
			async query(text, values = []) {
				if (text.includes('INSERT INTO auth_webauthn_credentials')) {
					if (inserted) return { rows: [] }
					inserted = true
					credential.owner = String(values[0])
					credential.counter = Number(values[3])
					insertedTransports = values[4]
					return { rows: [{ credential_id: values[1] }] }
				}
				if (text.includes('UPDATE auth_webauthn_credentials')) {
					const [newCounter, , owner, expectedCounter] = values
					if (credential.owner !== owner || credential.counter !== expectedCounter) {
						return { rows: [] }
					}
					credential.counter = Number(newCounter)
					return { rows: [{ credential_id: 'credential-1' }] }
				}
				if (text.includes('DELETE FROM auth_webauthn_credentials WHERE credential_id')) {
					const [, owner] = values
					if (credential.owner !== owner) return { rows: [] }
					return { rows: [{ credential_id: 'credential-1' }] }
				}
				if (text.includes('DELETE FROM auth_webauthn_challenges WHERE expires_at')) {
					return { rows: [{ id: 'expired-1' }, { id: 'expired-2' }] }
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
		const registration = {
			counter: 0,
			credentialId: 'credential-1',
			publicKey: 'public-key',
			userId: 'user-1'
		}

		await expect(adapters.webauthn.createCredential(registration)).resolves.toBe(true)
		expect(insertedTransports).toBeNull()
		await expect(
			adapters.webauthn.createCredential({ ...registration, userId: 'attacker' })
		).resolves.toBe(false)
		expect(credential.owner).toBe('user-1')
		await expect(
			adapters.webauthn.advanceCredentialCounter({
				credentialId: 'credential-1',
				userId: 'user-1',
				expectedCounter: 0,
				newCounter: 1
			})
		).resolves.toBe(true)
		await expect(
			adapters.webauthn.advanceCredentialCounter({
				credentialId: 'credential-1',
				userId: 'user-1',
				expectedCounter: 0,
				newCounter: 2
			})
		).resolves.toBe(false)
		await expect(
			adapters.webauthn.advanceCredentialCounter({
				credentialId: 'credential-1',
				userId: 'attacker',
				expectedCounter: 1,
				newCounter: 2
			})
		).resolves.toBe(false)
		await expect(
			adapters.webauthn.deleteCredential({
				credentialId: 'credential-1',
				userId: 'attacker'
			})
		).resolves.toBe(false)
		await expect(
			adapters.webauthn.deleteCredential({
				credentialId: 'credential-1',
				userId: 'user-1'
			})
		).resolves.toBe(true)
		await expect(adapters.webauthn.deleteExpiredChallenges(new Date())).resolves.toBe(2)
		expect(credential).toEqual({ counter: 1, owner: 'user-1' })
	})

	it('stores MFA secrets and backup codes through the postgres bundle', async () => {
		const queries: Array<{ text: string; values: readonly unknown[] }> = []
		let storedSecret = ''
		const db: PgPoolLike = {
			async query(text, values = []) {
				queries.push({ text, values })
				if (text.includes('INSERT INTO auth_mfa_factors')) {
					storedSecret = String(values[1])
					return { rows: [{ user_id: 'user-1' }] }
				}
				if (text.includes('UPDATE auth_mfa_factors AS factor')) {
					return { rows: [{ user_id: 'user-1' }] }
				}
				if (text.includes('SELECT user_id, secret, enabled_at FROM auth_mfa_factors')) {
					return {
						rows: [
							{
								enabled_at: new Date('2026-01-01T00:00:00.000Z'),
								secret: storedSecret,
								user_id: values[0]
							}
						]
					}
				}
				if (text.includes('SELECT code_hash FROM auth_mfa_backup_codes')) {
					return { rows: [{ code_hash: 'hash-1' }] }
				}
				if (text.includes('COUNT(c.code_hash)')) {
					return {
						rows: [
							{
								backup_code_count: '1',
								enabled_at: new Date('2026-01-01T00:00:00.000Z')
							}
						]
					}
				}
				if (text.includes('DELETE FROM auth_mfa_backup_codes')) {
					return { rows: [{ code_hash: 'hash-1' }] }
				}
				return { rows: [] }
			}
		}
		const adapters = createPgAuthAdapters({
			cookieName: 'auth',
			db,
			mfaSecretCodec,
			secureCookies: true
		})

		await expect(adapters.mfa.beginEnrollment('user-1', 'SECRET', ['hash-1'])).resolves.toBe(true)
		await expect(adapters.mfa.activateEnrollment('user-1')).resolves.toBe(true)
		const secret = await adapters.mfa.getSecret('user-1')
		const backupCodes = await adapters.mfa.getBackupCodes('user-1')
		const status = await adapters.mfa.getStatus('user-1')
		await expect(adapters.mfa.consumeBackupCode('user-1', 'hash-1')).resolves.toBe(true)

		expect(secret).toBe('SECRET')
		expect(storedSecret).not.toBe('SECRET')
		expect(storedSecret).not.toContain('SECRET')
		expect(backupCodes).toEqual(['hash-1'])
		expect(status).toEqual({
			backupCodeCount: 1,
			enabled: true,
			enabledAt: new Date('2026-01-01T00:00:00.000Z')
		})
		expect(queries.some((query) => query.text.includes('INSERT INTO auth_mfa_factors'))).toBe(true)
		expect(
			queries.some(
				(query) =>
					query.text.includes('INSERT INTO auth_mfa_backup_codes') &&
					query.text.includes('DELETE FROM auth_mfa_backup_codes')
			)
		).toBe(true)
	})

	it('rejects an MFA codec that returns plaintext', async () => {
		const db: PgPoolLike = {
			async query() {
				throw new Error('Database must not receive plaintext MFA secrets')
			}
		}
		const adapters = createPgAuthAdapters({
			cookieName: 'auth',
			db,
			mfaSecretCodec: {
				encrypt: async (secret) => secret,
				decrypt: async (ciphertext) => ciphertext
			},
			secureCookies: true
		})

		await expect(adapters.mfa.beginEnrollment('user-1', 'SECRET', ['hash-1'])).rejects.toThrow(
			'unencrypted plaintext'
		)
	})

	it('stores and atomically consumes magic link tokens through the postgres bundle', async () => {
		const expiresAt = new Date('2099-01-01T00:00:00.000Z')
		const rows = new Map<
			string,
			{
				created_at: Date
				email: string
				expires_at: Date
				id: string
				metadata: Record<string, unknown>
				otp_hash: string | null
				token_hash: string
				user_id: string | null
			}
		>()
		const queries: Array<{ text: string; values: readonly unknown[] }> = []
		const db: PgPoolLike = {
			async query(text, values = []) {
				queries.push({ text, values })
				if (text.includes('INSERT INTO auth_magic_link_tokens')) {
					const row = {
						created_at: new Date('2026-01-01T00:00:00.000Z'),
						email: values[2] as string,
						expires_at: values[5] as Date,
						id: values[0] as string,
						metadata: {},
						otp_hash: values[4] as string | null,
						token_hash: values[3] as string,
						user_id: values[1] as string | null
					}
					rows.set(row.id, row)
					return { rows: [row] }
				}
				if (text.includes('SELECT * FROM auth_magic_link_tokens WHERE token_hash')) {
					return {
						rows: [...rows.values()].filter((row) => row.token_hash === values[0])
					}
				}
				if (text.includes('SELECT * FROM auth_magic_link_tokens WHERE email')) {
					return {
						rows: [...rows.values()].filter(
							(row) => row.email === values[0] && row.otp_hash === values[1]
						)
					}
				}
				if (text.includes('DELETE FROM auth_magic_link_tokens WHERE token_hash')) {
					const row = [...rows.values()].find((candidate) => candidate.token_hash === values[0])
					if (row) rows.delete(row.id)
					return { rows: row ? [row] : [] }
				}
				if (text.includes('DELETE FROM auth_magic_link_tokens WHERE email')) {
					const deleted = [...rows.values()].filter(
						(row) => row.email === values[0] && row.otp_hash === values[1]
					)
					for (const row of deleted) rows.delete(row.id)
					return { rows: deleted }
				}
				return { rows: [] }
			}
		}
		const adapters = createPgAuthAdapters({
			cookieName: 'auth',
			db,
			mfaSecretCodec,
			secureCookies: true
		})

		const token = await adapters.magicLink.createToken({
			email: 'USER@example.test',
			expiresAt,
			otpHash: 'otp-hash',
			tokenHash: 'token-hash',
			userId: 'user-1'
		})
		const byToken = await adapters.magicLink.findByTokenHash('token-hash')
		const byOtp = await adapters.magicLink.findByEmailAndOtpHash({
			email: 'user@example.test',
			otpHash: 'otp-hash'
		})
		const consumed = await adapters.magicLink.consumeByTokenHash('token-hash')

		expect(token.email).toBe('user@example.test')
		expect(byToken?.id).toBe(token.id)
		expect(byOtp?.id).toBe(token.id)
		expect(consumed?.id).toBe(token.id)
		expect(await adapters.magicLink.findByTokenHash('token-hash')).toBeNull()
		expect(queries.some((query) => query.text.includes('RETURNING *'))).toBe(true)
	})
})
