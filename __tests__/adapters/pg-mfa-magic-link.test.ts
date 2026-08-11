import { describe, expect, it } from 'vitest'

import { createPgAuthAdapters, type PgPoolLike } from '../../src/adapters/pg/index.ts'
import { mfaSecretCodec } from './_pgTestKit.ts'

describe('pg MFA and magic-link adapters', () => {
	it('stores MFA secrets and backup codes through the postgres bundle', async () => {
		const queries: Array<{ text: string; values: readonly unknown[] }> = []
		let storedSecret = ''
		let lastUsedCounter: number | null = null
		const db: PgPoolLike = {
			async query(text, values = []) {
				queries.push({ text, values })
				if (text.includes('INSERT INTO auth_mfa_factors')) {
					storedSecret = String(values[1])
					return { rows: [{ user_id: 'user-1' }] }
				}
				if (text.includes('UPDATE auth_mfa_factors AS factor')) {
					lastUsedCounter = Number(values[1])
					return { rows: [{ user_id: 'user-1' }] }
				}
				if (text.includes('SET last_used_counter')) {
					const counter = Number(values[1])
					if (lastUsedCounter !== null && counter <= lastUsedCounter) return { rows: [] }
					lastUsedCounter = counter
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
		await expect(adapters.mfa.activateEnrollment('user-1', 100)).resolves.toBe(true)
		await expect(adapters.mfa.consumeTotpCounter('user-1', 101)).resolves.toBe(true)
		await expect(adapters.mfa.consumeTotpCounter('user-1', 101)).resolves.toBe(false)
		await expect(adapters.mfa.consumeTotpCounter('user-1', 100)).resolves.toBe(false)
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
