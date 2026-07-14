import { describe, expect, it } from 'vitest'

import {
	createPgAuthAdapters,
	pgAuthSchemaSql,
	type PgPoolLike
} from '../../src/adapters/pg/index.ts'

describe('pg auth adapters', () => {
	it('exposes the default postgres schema', () => {
		expect(pgAuthSchemaSql).toContain('CREATE TABLE IF NOT EXISTS auth_users')
		expect(pgAuthSchemaSql).toContain('CREATE TABLE IF NOT EXISTS auth_sessions')
		expect(pgAuthSchemaSql).toContain('CREATE TABLE IF NOT EXISTS auth_oauth_accounts')
		expect(pgAuthSchemaSql).toContain('CREATE TABLE IF NOT EXISTS auth_mfa_factors')
		expect(pgAuthSchemaSql).toContain('CREATE TABLE IF NOT EXISTS auth_mfa_backup_codes')
		expect(pgAuthSchemaSql).toContain('CREATE TABLE IF NOT EXISTS auth_webauthn_challenges')
		expect(pgAuthSchemaSql).toContain('CREATE TABLE IF NOT EXISTS auth_webauthn_credentials')
		expect(pgAuthSchemaSql).toContain('CREATE TABLE IF NOT EXISTS auth_magic_link_tokens')
	})

	it('creates sessions through a node-postgres compatible pool', async () => {
		const db: PgPoolLike = {
			async query(text, values = []) {
				if (text.includes('INSERT INTO auth_sessions')) {
					return {
						rows: [
							{
								created_at: new Date('2099-01-01T00:00:00.000Z'),
								expires_at: values[2],
								fingerprint: values[5] ?? null,
								id: values[0],
								ip: values[3] ?? null,
								last_active_at: null,
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
			secureCookies: true
		})

		const session = await adapters.session.createSession('user-1', {
			fingerprint: 'fingerprint',
			ip: '127.0.0.1',
			userAgent: 'vitest'
		})

		expect(session.userId).toBe('user-1')
		expect(session.fingerprint).toBe('fingerprint')
	})

	it('creates WebAuthn challenges and credentials through the postgres bundle', async () => {
		const queries: Array<{ text: string; values: readonly unknown[] }> = []
		const db: PgPoolLike = {
			async query(text, values = []) {
				queries.push({ text, values })
				if (text.includes('SELECT * FROM auth_webauthn_challenges')) {
					return {
						rows: [
							{
								challenge: 'challenge',
								expires_at: new Date('2099-01-01T00:00:00.000Z'),
								id: values[0],
								type: 'registration',
								user_id: 'user-1'
							}
						]
					}
				}
				if (text.includes('SELECT * FROM auth_webauthn_credentials WHERE credential_id')) {
					return {
						rows: [
							{
								counter: 0,
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
			secureCookies: true
		})

		await adapters.webauthn.createChallenge({
			challenge: 'challenge',
			challengeId: 'challenge-1',
			expiresAt: new Date('2099-01-01T00:00:00.000Z'),
			type: 'registration',
			userId: 'user-1'
		})
		await adapters.webauthn.createCredential({
			counter: 0,
			credentialId: 'credential-1',
			name: 'Work laptop',
			publicKey: 'public-key',
			transports: ['internal'],
			userId: 'user-1'
		})
		const challenge = await adapters.webauthn.getChallenge('challenge-1')
		const credential = await adapters.webauthn.getCredential('credential-1')

		expect(challenge?.id).toBe('challenge-1')
		expect(credential?.transports).toEqual(['internal'])
		expect(
			queries.some((query) => query.text.includes('INSERT INTO auth_webauthn_challenges'))
		).toBe(true)
		expect(
			queries.some((query) => query.text.includes('INSERT INTO auth_webauthn_credentials'))
		).toBe(true)
	})

	it('stores MFA secrets and backup codes through the postgres bundle', async () => {
		const queries: Array<{ text: string; values: readonly unknown[] }> = []
		const db: PgPoolLike = {
			async query(text, values = []) {
				queries.push({ text, values })
				if (text.includes('SELECT user_id, secret, enabled_at FROM auth_mfa_factors')) {
					return {
						rows: [
							{
								enabled_at: new Date('2026-01-01T00:00:00.000Z'),
								secret: 'SECRET',
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
				return { rows: [] }
			}
		}
		const adapters = createPgAuthAdapters({
			cookieName: 'auth',
			db,
			secureCookies: true
		})

		await adapters.mfa.setSecret('user-1', 'SECRET')
		await adapters.mfa.setBackupCodes('user-1', ['hash-1'])
		await adapters.mfa.enableMfa('user-1')
		const secret = await adapters.mfa.getSecret('user-1')
		const backupCodes = await adapters.mfa.getBackupCodes('user-1')
		const status = await adapters.mfa.getStatus('user-1')
		await adapters.mfa.consumeBackupCode('user-1', 'hash-1')

		expect(secret).toBe('SECRET')
		expect(backupCodes).toEqual(['hash-1'])
		expect(status).toEqual({
			backupCodeCount: 1,
			enabled: true,
			enabledAt: new Date('2026-01-01T00:00:00.000Z')
		})
		expect(queries.some((query) => query.text.includes('INSERT INTO auth_mfa_factors'))).toBe(true)
		expect(queries.some((query) => query.text.includes('INSERT INTO auth_mfa_backup_codes'))).toBe(
			true
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
