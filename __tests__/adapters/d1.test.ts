import { describe, expect, it } from 'vitest'

import { D1UserAdapter } from '../../src/adapters/database/D1UserAdapter.ts'
import { D1TokenAdapter } from '../../src/adapters/oauth-token/D1TokenAdapter.ts'
import { D1SessionAdapter } from '../../src/adapters/session/D1SessionAdapter.ts'
import { D1VerificationTokenAdapter } from '../../src/adapters/verification-token/D1VerificationTokenAdapter.ts'

type TableRow = Record<string, unknown>
type Tables = Record<string, TableRow[]>
type RowPredicate = (row: TableRow) => boolean

function createMockDb() {
	const tables: Tables = {
		users: [],
		sessions: [],
		oauth_accounts: [],
		oauth_tokens: [],
		verification_tokens: []
	}
	let lastRowId = 0

	function insert(table: string, row: TableRow) {
		if (!tables[table]) tables[table] = []
		const id = ++lastRowId
		const data = { ...row }
		if (!('id' in data)) data.id = id
		tables[table].push(data)
		return { last_row_id: data.id }
	}

	function deleteWhere(table: string, fn: RowPredicate) {
		if (!tables[table]) tables[table] = []
		tables[table] = tables[table].filter((row) => !fn(row))
	}

	function updateWhere(table: string, fn: RowPredicate, updates: TableRow) {
		if (!tables[table]) tables[table] = []
		for (const row of tables[table]) {
			if (fn(row)) Object.assign(row, updates)
		}
	}

	function findWhere(table: string, fn: RowPredicate) {
		if (!tables[table]) tables[table] = []
		return tables[table].find(fn) || null
	}

	function findAll(table: string, fn: RowPredicate) {
		if (!tables[table]) tables[table] = []
		return tables[table].filter(fn)
	}

	return {
		prepare(sql: string) {
			let bound: unknown[] = []
			return {
				bind(...args: unknown[]) {
					bound = args
					return this
				},
				run() {
					if (sql.startsWith('INSERT INTO users')) {
						const columns = /INSERT INTO users \(([^)]+)\)/
							.exec(sql)?.[1]
							?.split(',')
							.map((value) => value.trim())
						if (!columns) throw new Error(`Unable to parse user insert: ${sql}`)
						return {
							meta: insert(
								'users',
								Object.fromEntries(columns.map((column, i) => [column, bound[i]]))
							)
						}
					}
					if (sql.startsWith('UPDATE users SET')) {
						const columns = /UPDATE users SET (.+) WHERE/
							.exec(sql)?.[1]
							?.split(',')
							.map((value) => value.split('=')[0]?.trim())
							.filter((value): value is string => Boolean(value))
						if (!columns) throw new Error(`Unable to parse user update: ${sql}`)
						const id = bound.at(-1)
						updateWhere(
							'users',
							(row) => row.id === id,
							Object.fromEntries(columns.map((column, i) => [column, bound[i]]))
						)
						return { meta: { changes: 1 } }
					}
					if (sql.startsWith('INSERT INTO oauth_accounts')) {
						const [user_id, provider, provider_account_id] = bound
						return { meta: insert('oauth_accounts', { user_id, provider, provider_account_id }) }
					}
					if (sql.startsWith('INSERT INTO sessions')) {
						const [id, user_id, expires_at, mfa_verified_at] = bound
						return { meta: insert('sessions', { id, user_id, expires_at, mfa_verified_at }) }
					}
					if (sql.startsWith('UPDATE sessions SET')) {
						const [expires_at, id] = bound
						updateWhere('sessions', (r) => r.id === id, { expires_at })
						return { meta: { changes: 1 } }
					}
					if (sql.startsWith('DELETE FROM sessions')) {
						const [value] = bound
						if (sql.includes('user_id')) {
							deleteWhere('sessions', (r) => r.user_id === value)
						} else {
							deleteWhere('sessions', (r) => r.id === value)
						}
						return { meta: { changes: 1 } }
					}
					if (sql.startsWith('DELETE FROM oauth_tokens')) {
						const [user_id, provider] = bound
						deleteWhere('oauth_tokens', (r) => r.user_id === user_id && r.provider === provider)
						return { meta: { changes: 1 } }
					}
					if (sql.startsWith('INSERT INTO oauth_tokens')) {
						const [user_id, provider, tokens] = bound
						return { meta: insert('oauth_tokens', { user_id, provider, tokens }) }
					}
					if (sql.startsWith('INSERT INTO verification_tokens')) {
						const [id, user_id, type, token, expires_at, created_at] = bound
						const row: TableRow = { id, user_id, type, token, expires_at }
						if (sql.includes('created_at')) row.created_at = created_at
						return { meta: insert('verification_tokens', row) }
					}
					if (sql.startsWith('DELETE FROM verification_tokens')) {
						if (sql.includes('id = ?')) {
							const [id] = bound
							deleteWhere('verification_tokens', (r) => r.id === id)
						} else {
							const [user_id, type] = bound
							deleteWhere('verification_tokens', (r) => r.user_id === user_id && r.type === type)
						}
						return { meta: { changes: 1 } }
					}
					return { meta: { changes: 0 } }
				},
				first() {
					if (sql.startsWith('DELETE FROM verification_tokens') && sql.includes('RETURNING')) {
						const [token, type] = bound
						const vt = findWhere('verification_tokens', (r) => r.token === token && r.type === type)
						if (!vt) return null
						deleteWhere('verification_tokens', (r) => r.id === vt.id)
						return vt
					}
					if (sql.includes('FROM users') && sql.includes('WHERE id')) {
						const [id] = bound
						return findWhere('users', (r) => r.id === id)
					}
					if (
						sql.includes('FROM users') &&
						(sql.includes('WHERE email') || sql.includes('WHERE lower(email)'))
					) {
						const [email] = bound
						return findWhere('users', (r) => r.email === email)
					}
					if (sql.includes('FROM oauth_accounts')) {
						const [provider, provider_account_id] = bound
						const acct = findWhere(
							'oauth_accounts',
							(r) => r.provider === provider && r.provider_account_id === provider_account_id
						)
						if (!acct) return null
						return findWhere('users', (r) => r.id === acct.user_id)
					}
					if (sql.includes('FROM sessions') && sql.includes('JOIN users')) {
						const [id] = bound
						const session = findWhere('sessions', (r) => r.id === id)
						if (!session) return null
						const user = findWhere('users', (r) => r.id === session.user_id)
						return {
							...user,
							session_id: session.id,
							user_id: session.user_id,
							expires_at: session.expires_at,
							mfa_verified_at: session.mfa_verified_at
						}
					}
					if (sql.includes('FROM oauth_tokens')) {
						const [user_id, provider] = bound
						return (
							findWhere('oauth_tokens', (r) => r.user_id === user_id && r.provider === provider) ||
							null
						)
					}
					if (sql.includes('FROM verification_tokens') && sql.includes('JOIN users')) {
						const [token, type] = bound
						const vt = findWhere('verification_tokens', (r) => r.token === token && r.type === type)
						if (!vt) return null
						const user = findWhere('users', (r) => r.id === vt.user_id)
						if (sql.includes(' AS token_id')) {
							return {
								token_id: vt.id,
								token_user_id: vt.user_id,
								token_type: vt.type,
								verification_token: vt.token,
								token_expires_at: vt.expires_at,
								...(sql.includes(' AS token_created_at')
									? { token_created_at: vt.created_at }
									: {}),
								user_id: user?.id,
								user_email: user?.email,
								user_name: user?.name,
								user_avatar: user?.avatar ?? null
							}
						}
						return { ...vt, ...user }
					}
					return null
				},
				all() {
					if (sql.includes('FROM sessions')) {
						const [user_id] = bound
						return { results: findAll('sessions', (r) => r.user_id === user_id) }
					}
					if (sql.includes('FROM oauth_tokens')) {
						const [user_id] = bound
						return { results: findAll('oauth_tokens', (r) => r.user_id === user_id) }
					}
					return { results: [] }
				}
			}
		}
	}
}

describe('D1 adapters', () => {
	it('creates user and session and validates', async () => {
		const db = createMockDb()
		const userAdapter = new D1UserAdapter(db)
		const sessionAdapter = new D1SessionAdapter(db, {
			sessionLifetime: 1000,
			sessionRefreshThreshold: 500
		})

		const user = await userAdapter.createUser({ email: 'a@b.com', name: 'A', verified_email: true })
		const mfaVerifiedAt = new Date('2026-07-14T12:00:00.000Z')
		const session = await sessionAdapter.createSession(user.id, { mfaVerifiedAt })
		const result = await sessionAdapter.validateSession(session.id)
		expect(result.user?.email).toBe('a@b.com')
		expect(result.session?.id).toBe(session.id)
		expect(result.session?.mfaVerifiedAt).toEqual(mfaVerifiedAt)
		expect((await sessionAdapter.listSessions(user.id))[0]?.mfaVerifiedAt).toEqual(mfaVerifiedAt)
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
		const tokenAdapter = new D1TokenAdapter(db, { encryptionKey: 'a'.repeat(64) })
		await tokenAdapter.storeTokens('1', 'google', {
			accessToken: 'x',
			refreshToken: null,
			scope: null,
			accessTokenExpiresAt: new Date().toISOString()
		})
		const tokens = await tokenAdapter.getTokens('1', 'google')
		expect(tokens?.accessToken).toBe('x')
	})

	it('creates and finds verification tokens', async () => {
		const db = createMockDb()
		const userAdapter = new D1UserAdapter(db)
		const user = await userAdapter.createUser({ email: 'c@d.com', name: 'C' })
		const tokens = new D1VerificationTokenAdapter(db)
		await tokens.create({
			userId: user.id,
			type: 'email_verification',
			token: 't',
			expiresAt: new Date(Date.now() + 1000)
		})
		const record = await tokens.findByToken({ token: 't', type: 'email_verification' })
		expect(record?.user?.email).toBe('c@d.com')
	})

	it('supports verification token tables with required created_at columns', async () => {
		const db = createMockDb()
		const userAdapter = new D1UserAdapter(db)
		const user = await userAdapter.createUser({ email: 'created@example.com', name: 'Created' })
		const tokens = new D1VerificationTokenAdapter(db, {
			columns: { createdAt: 'created_at' }
		})

		await tokens.create({
			userId: user.id,
			type: 'email_verification',
			token: 'created-token',
			expiresAt: new Date(Date.now() + 1000)
		})
		const record = await tokens.findByToken({
			token: 'created-token',
			type: 'email_verification'
		})

		expect(record?.token.createdAt).toBeInstanceOf(Date)
		expect(record?.token.createdAt.getTime()).toBeGreaterThan(0)
	})

	it('keeps D1 verification token and user ids distinct', async () => {
		const db = createMockDb()
		const userAdapter = new D1UserAdapter(db)
		const user = await userAdapter.createUser({ email: 'token-owner@example.com', name: 'Owner' })
		const tokens = new D1VerificationTokenAdapter(db)
		await tokens.create({
			userId: user.id,
			type: 'email_verification',
			token: 'distinct-token',
			expiresAt: new Date(Date.now() + 1000)
		})

		const record = await tokens.findByToken({
			token: 'distinct-token',
			type: 'email_verification'
		})

		expect(record?.token.id).not.toBe(user.id)
		expect(record?.token.userId).toBe(user.id)
		expect(record?.user.id).toBe(user.id)
	})

	it('atomically consumes D1 verification tokens without id collisions', async () => {
		const db = createMockDb()
		const userAdapter = new D1UserAdapter(db)
		const user = await userAdapter.createUser({ email: 'consume-owner@example.com', name: 'Owner' })
		const tokens = new D1VerificationTokenAdapter(db)
		await tokens.create({
			userId: user.id,
			type: 'email_verification',
			token: 'consume-token',
			expiresAt: new Date(Date.now() + 1000)
		})

		const consumed = await tokens.consumeByToken({
			token: 'consume-token',
			type: 'email_verification'
		})
		const second = await tokens.consumeByToken({
			token: 'consume-token',
			type: 'email_verification'
		})

		expect(consumed?.token.id).not.toBe(user.id)
		expect(consumed?.token.userId).toBe(user.id)
		expect(consumed?.user.id).toBe(user.id)
		expect(second).toBeNull()
	})
})
