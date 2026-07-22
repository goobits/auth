import { describe, expect, it } from 'vitest'

import { D1MagicLinkAdapter } from '../../src/adapters/magic-link/D1MagicLinkAdapter.ts'

type D1Row = Record<string, string | number | boolean | null>
type DbCall = { kind: 'first' | 'run'; sql: string; values: unknown[] }

function createDb(firstRows: Array<D1Row | null> = []) {
	const calls: DbCall[] = []
	const db = {
		prepare(sql: string) {
			return {
				bind(...values: unknown[]) {
					return {
						async run() {
							calls.push({ kind: 'run', sql, values })
						},
						async first() {
							calls.push({ kind: 'first', sql, values })
							return firstRows.shift() ?? null
						}
					}
				}
			}
		}
	}
	return { calls, db }
}

const customColumns = {
	id: 'token_id',
	userId: 'owner_id',
	email: 'email_address',
	tokenHash: 'token_digest',
	otpHash: 'otp_digest',
	expiresAt: 'expires_on',
	createdAt: 'created_on'
}

function tokenRow(overrides: D1Row = {}): D1Row {
	return {
		token_id: 'token-1',
		owner_id: 'user-1',
		email_address: 'member@example.com',
		token_digest: 'token-hash',
		otp_digest: 'otp-hash',
		expires_on: '2099-01-01T00:00:00.000Z',
		created_on: '2026-07-19T00:00:00.000Z',
		...overrides
	}
}

describe('D1MagicLinkAdapter', () => {
	it('uses configured storage names and atomically consumes token hashes', async () => {
		const { calls, db } = createDb([tokenRow(), tokenRow(), null])
		const adapter = new D1MagicLinkAdapter(db as never, {
			tokensTable: 'bandamp_magic_links',
			columns: customColumns
		})
		const expiresAt = new Date('2099-01-01T00:00:00.000Z')

		const created = await adapter.createToken({
			userId: 'user-1',
			email: 'member@example.com',
			tokenHash: 'token-hash',
			otpHash: 'otp-hash',
			expiresAt,
			metadata: { requestId: 'request-1' }
		})
		await expect(adapter.findByTokenHash('token-hash')).resolves.toMatchObject({
			id: 'token-1',
			userId: 'user-1',
			expiresAt,
			createdAt: new Date('2026-07-19T00:00:00.000Z')
		})
		await expect(adapter.consumeByTokenHash('token-hash')).resolves.toMatchObject({
			id: 'token-1'
		})
		await expect(adapter.consumeByTokenHash('token-hash')).resolves.toBeNull()

		expect(created).toMatchObject({
			userId: 'user-1',
			email: 'member@example.com',
			tokenHash: 'token-hash',
			otpHash: 'otp-hash',
			expiresAt,
			requestId: 'request-1'
		})
		expect(calls[0]).toMatchObject({
			kind: 'run',
			sql: expect.stringContaining(
				'INSERT INTO bandamp_magic_links (token_id, owner_id, email_address, token_digest, otp_digest, expires_on)'
			),
			values: [
				expect.any(String),
				'user-1',
				'member@example.com',
				'token-hash',
				'otp-hash',
				expiresAt.toISOString()
			]
		})
		expect(calls[2]?.sql).toContain(
			'DELETE FROM bandamp_magic_links WHERE token_digest = ? RETURNING *'
		)
	})

	it('atomically consumes OTPs and owns every delete operation', async () => {
		const { calls, db } = createDb([tokenRow({ owner_id: null })])
		const adapter = new D1MagicLinkAdapter(db as never, {
			tokensTable: 'bandamp_magic_links',
			columns: customColumns
		})

		await expect(
			adapter.consumeByEmailAndOtpHash({
				email: 'member@example.com',
				otpHash: 'otp-hash'
			})
		).resolves.toMatchObject({ userId: null, email: 'member@example.com' })
		await adapter.deleteById('token-1')
		await adapter.deleteByUserId('user-1')
		await adapter.deleteByEmail('member@example.com')

		expect(calls.map(({ sql }) => sql)).toEqual([
			'DELETE FROM bandamp_magic_links WHERE email_address = ? AND otp_digest = ? RETURNING *',
			'DELETE FROM bandamp_magic_links WHERE token_id = ?',
			'DELETE FROM bandamp_magic_links WHERE owner_id = ?',
			'DELETE FROM bandamp_magic_links WHERE email_address = ?'
		])
	})

	it.each([
		['identifier', tokenRow({ token_id: 123 })],
		['user identifier', tokenRow({ owner_id: true })],
		['expiry', tokenRow({ expires_on: 'not-a-date' })],
		['OTP hash', tokenRow({ otp_digest: 123 })]
	])('rejects a malformed %s row', async (_name, row) => {
		const { db } = createDb([row])
		const adapter = new D1MagicLinkAdapter(db as never, { columns: customColumns })

		await expect(adapter.findByTokenHash('token-hash')).resolves.toBeNull()
	})

	it('falls back to a valid creation timestamp when legacy data is malformed', async () => {
		const { db } = createDb([tokenRow({ created_on: 'not-a-date' })])
		const adapter = new D1MagicLinkAdapter(db as never, { columns: customColumns })

		const token = await adapter.findByTokenHash('token-hash')
		expect(token?.createdAt).toBeInstanceOf(Date)
		expect(Number.isNaN(token?.createdAt.getTime())).toBe(false)
	})
})
