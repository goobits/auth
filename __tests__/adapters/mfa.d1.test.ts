import { describe, expect, it } from 'vitest'

import { createAesGcmMfaSecretCodec } from '../../src/adapters/mfa/aesGcmMfaSecretCodec.ts'
import { D1MfaAdapter } from '../../src/adapters/mfa/D1MfaAdapter.ts'

type Factor = { secret: string; enabledAt: string | null }
type BackupCode = { userId: string; hash: string; createdAt: number }

function createMockD1() {
	const factors = new Map<string, Factor>()
	let backupCodes: BackupCode[] = []
	let sequence = 0

	function execute(sql: string, args: unknown[]) {
		const normalized = sql.replace(/\s+/g, ' ').trim()
		if (normalized.startsWith('INSERT INTO auth_mfa_factors')) {
			const [userId, secret] = args.map(String)
			const current = factors.get(userId)
			if (current?.enabledAt) return { results: [], meta: { changes: 0 } }
			factors.set(userId, { secret, enabledAt: null })
			return { results: [{ user_id: userId }], meta: { changes: 1 } }
		}
		if (
			normalized.startsWith('DELETE FROM auth_mfa_backup_codes') &&
			normalized.includes('AND EXISTS')
		) {
			const [userId, factorUserId, secret] = args.map(String)
			const factor = factors.get(factorUserId)
			if (!factor || factor.enabledAt || factor.secret !== secret) {
				return { results: [], meta: { changes: 0 } }
			}
			const before = backupCodes.length
			backupCodes = backupCodes.filter((code) => code.userId !== userId)
			return { results: [], meta: { changes: before - backupCodes.length } }
		}
		if (normalized.startsWith('INSERT INTO auth_mfa_backup_codes')) {
			const [userId, hash, factorUserId, secret] = args.map(String)
			const factor = factors.get(factorUserId)
			if (!factor || factor.enabledAt || factor.secret !== secret) {
				return { results: [], meta: { changes: 0 } }
			}
			backupCodes.push({ userId, hash, createdAt: ++sequence })
			return { results: [], meta: { changes: 1 } }
		}
		if (normalized.startsWith('SELECT secret AS secret FROM auth_mfa_factors')) {
			const factor = factors.get(String(args[0]))
			return { results: factor ? [{ secret: factor.secret }] : [], meta: { changes: 0 } }
		}
		if (normalized.startsWith('UPDATE auth_mfa_factors SET enabled_at')) {
			const userId = String(args[0])
			const factor = factors.get(userId)
			if (!factor || factor.enabledAt || !backupCodes.some((code) => code.userId === userId)) {
				return { results: [], meta: { changes: 0 } }
			}
			factor.enabledAt = '2026-07-15T12:00:00.000Z'
			return { results: [{ user_id: userId }], meta: { changes: 1 } }
		}
		if (
			normalized.startsWith('DELETE FROM auth_mfa_backup_codes') &&
			normalized.includes('code_hash = ?')
		) {
			const [userId, hash] = args.map(String)
			const index = backupCodes.findIndex((code) => code.userId === userId && code.hash === hash)
			if (index < 0) return { results: [], meta: { changes: 0 } }
			backupCodes.splice(index, 1)
			return { results: [{ code_hash: hash }], meta: { changes: 1 } }
		}
		if (normalized.startsWith('DELETE FROM auth_mfa_backup_codes')) {
			const userId = String(args[0])
			const before = backupCodes.length
			backupCodes = backupCodes.filter((code) => code.userId !== userId)
			return { results: [], meta: { changes: before - backupCodes.length } }
		}
		if (normalized.startsWith('DELETE FROM auth_mfa_factors')) {
			const userId = String(args[0])
			const removed = factors.delete(userId)
			return {
				results: removed ? [{ user_id: userId }] : [],
				meta: { changes: removed ? 1 : 0 }
			}
		}
		if (normalized.startsWith('SELECT code_hash AS code_hash')) {
			return {
				results: backupCodes
					.filter((code) => code.userId === String(args[0]))
					.sort((a, b) => a.createdAt - b.createdAt)
					.map((code) => ({ code_hash: code.hash })),
				meta: { changes: 0 }
			}
		}
		if (normalized.startsWith('SELECT factor.enabled_at AS enabled_at')) {
			const userId = String(args[0])
			const factor = factors.get(userId)
			return {
				results: factor
					? [
							{
								enabled_at: factor.enabledAt,
								backup_code_count: backupCodes.filter((code) => code.userId === userId).length
							}
						]
					: [],
				meta: { changes: 0 }
			}
		}
		throw new Error(`Unhandled SQL: ${normalized}`)
	}

	function prepare(sql: string) {
		let args: unknown[] = []
		const statement = {
			bind(...values: unknown[]) {
				args = values
				return statement
			},
			async first() {
				return execute(sql, args).results[0] ?? null
			},
			async all() {
				return { results: execute(sql, args).results }
			},
			async run() {
				return execute(sql, args)
			},
			_execute() {
				return execute(sql, args)
			}
		}
		return statement
	}

	return {
		db: {
			prepare,
			async batch(statements: Array<ReturnType<typeof prepare>>) {
				return statements.map((statement) => statement._execute())
			}
		},
		ciphertext(userId: string) {
			return factors.get(userId)?.secret ?? null
		}
	}
}

function key(hexPair: string): string {
	return hexPair.repeat(32)
}

function keyring(activeKeyId: string, keys: Record<string, string>): string {
	return JSON.stringify({ activeKeyId, keys })
}

describe('D1MfaAdapter', () => {
	it('encrypts factors, protects active enrollment, and consumes backup codes once', async () => {
		const d1 = createMockD1()
		const codec = createAesGcmMfaSecretCodec({
			keyringJson: keyring('current', { current: key('11') })
		})
		const adapter = new D1MfaAdapter(d1.db, { secretCodec: codec })

		await expect(adapter.beginEnrollment('u1', 'FIRST-SECRET', ['hash-1', 'hash-2'])).resolves.toBe(
			true
		)
		expect(d1.ciphertext('u1')).not.toContain('FIRST-SECRET')
		await expect(adapter.activateEnrollment('u1')).resolves.toBe(true)
		await expect(adapter.beginEnrollment('u1', 'SECOND-SECRET', ['hash-3'])).resolves.toBe(false)
		await expect(adapter.getSecret('u1')).resolves.toBe('FIRST-SECRET')
		await expect(adapter.getStatus('u1')).resolves.toMatchObject({
			enabled: true,
			backupCodeCount: 2
		})
		await expect(adapter.consumeBackupCode('u1', 'hash-1')).resolves.toBe(true)
		await expect(adapter.consumeBackupCode('u1', 'hash-1')).resolves.toBe(false)
		await expect(adapter.disableMfa('u1')).resolves.toBe(true)
		await expect(adapter.getStatus('u1')).resolves.toEqual({
			enabled: false,
			enabledAt: null,
			backupCodeCount: 0
		})
	})

	it('requires transactional batches and rejects unsafe identifiers', () => {
		const secretCodec = { encrypt: async (value: string) => value, decrypt: async () => 'secret' }
		expect(() => new D1MfaAdapter({ prepare: () => ({}) } as never, { secretCodec })).toThrow(
			/transactional batch/
		)
		const d1 = createMockD1()
		expect(
			() => new D1MfaAdapter(d1.db, { secretCodec, factorsTable: 'factors; DROP TABLE users' })
		).toThrow(/invalid D1 MFA/)
	})
})

describe('AES-GCM MFA secret codec', () => {
	it('opens retired-key ciphertext after rotation and binds ciphertext to the user', async () => {
		const oldCodec = createAesGcmMfaSecretCodec({
			keyringJson: keyring('old', { old: key('22') })
		})
		const ciphertext = await oldCodec.encrypt('TOTP-SECRET', 'u1')
		const rotatedCodec = createAesGcmMfaSecretCodec({
			keyringJson: keyring('new', { old: key('22'), new: key('33') })
		})

		await expect(rotatedCodec.decrypt(ciphertext, 'u1')).resolves.toBe('TOTP-SECRET')
		await expect(rotatedCodec.decrypt(ciphertext, 'u2')).rejects.toThrow(
			'unable to decrypt MFA secret'
		)
		const newCiphertext = await rotatedCodec.encrypt('TOTP-SECRET', 'u1')
		expect(JSON.parse(newCiphertext)).toMatchObject({ keyId: 'new' })
		expect(newCiphertext).not.toContain('TOTP-SECRET')
	})
})
