import { describe, expect, it } from 'vitest'

import { D1UserAdapter } from '../../src/adapters/database/D1UserAdapter.ts'
import { D1MagicLinkAdapter } from '../../src/adapters/magic-link/D1MagicLinkAdapter.ts'
import { D1TokenAdapter } from '../../src/adapters/oauth-token/D1TokenAdapter.ts'
import { D1SessionAdapter } from '../../src/adapters/session/D1SessionAdapter.ts'
import { D1VerificationTokenAdapter } from '../../src/adapters/verification-token/D1VerificationTokenAdapter.ts'
import { D1WebAuthnAdapter } from '../../src/adapters/webauthn/D1WebAuthnAdapter.ts'

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
		_tables: tables,
		prepare(sql: string) {
			sql = sql.replaceAll('"', '')
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
						const columns = /INSERT INTO sessions \(([^)]+)\)/
							.exec(sql)?.[1]
							?.split(',')
							.map((value) => value.trim())
						if (!columns) throw new Error(`Unable to parse session insert: ${sql}`)
						return {
							meta: insert(
								'sessions',
								Object.fromEntries(columns.map((column, i) => [column, bound[i]]))
							)
						}
					}
					if (sql.startsWith('UPDATE sessions SET')) {
						const [expires_at, id] = bound
						updateWhere('sessions', (r) => r.id === id, { expires_at })
						return { meta: { changes: 1 } }
					}
					if (sql.startsWith('DELETE FROM sessions')) {
						const [value, userId] = bound
						if (sql.includes('management_id')) {
							deleteWhere('sessions', (r) => r.management_id === value && r.user_id === userId)
						} else if (sql.includes('user_id')) {
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
						if (sql.includes('ON CONFLICT')) {
							const existing = findWhere(
								'oauth_tokens',
								(row) => row.user_id === user_id && row.provider === provider
							)
							if (existing) {
								existing.tokens = tokens
								return { meta: { changes: 1 } }
							}
						}
						return { meta: insert('oauth_tokens', { user_id, provider, tokens }) }
					}
					if (sql.startsWith('INSERT INTO verification_tokens')) {
						const columns = /INSERT INTO verification_tokens \(([^)]+)\)/
							.exec(sql)?.[1]
							?.split(',')
							.map((value) => value.trim())
						if (!columns) throw new Error(`Unable to parse verification token insert: ${sql}`)
						const row = Object.fromEntries(columns.map((column, i) => [column, bound[i]]))
						if (sql.includes('ON CONFLICT')) {
							const existing = findWhere(
								'verification_tokens',
								(value) => value.user_id === row.user_id && value.type === row.type
							)
							if (existing) {
								Object.assign(existing, row)
								return { meta: { changes: 1 } }
							}
						}
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
							session_management_id: session.management_id,
							user_id: session.user_id,
							expires_at: session.expires_at,
							mfa_verified_at: session.mfa_verified_at,
							session_created_at: session.created_at,
							last_active_at: session.last_active_at,
							session_ip: session.ip,
							session_user_agent: session.user_agent
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
								...(sql.includes(' AS token_metadata') ? { token_metadata: vt.metadata } : {}),
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
		const tokenAdapter = new D1TokenAdapter(db, { encryptionKey: 'a'.repeat(64) })
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
					encryptionKey: 'a'.repeat(64)
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

	it('keeps D1 WebAuthn owners immutable and counters compare-and-swap protected', async () => {
		type Credential = { userId: string; publicKey: string; counter: number }
		const credentials = new Map<string, Credential>()
		const db = {
			prepare(sql: string) {
				let values: unknown[] = []
				return {
					bind(...bound: unknown[]) {
						values = bound
						return this
					},
					async run() {
						if (sql.startsWith('INSERT INTO webauthn_credentials')) {
							const [userId, credentialId, publicKey, counter] = values as [
								string,
								string,
								string,
								number
							]
							if (credentials.has(credentialId)) return { meta: { changes: 0 } }
							credentials.set(credentialId, { userId, publicKey, counter })
							return { meta: { changes: 1 } }
						}
						if (sql.startsWith('UPDATE webauthn_credentials')) {
							const [newCounter, , credentialId, userId, expectedCounter] = values as [
								number,
								string,
								string,
								string,
								number
							]
							const current = credentials.get(credentialId)
							if (!current || current.userId !== userId || current.counter !== expectedCounter) {
								return { meta: { changes: 0 } }
							}
							credentials.set(credentialId, { ...current, counter: newCounter })
							return { meta: { changes: 1 } }
						}
						return { meta: { changes: 0 } }
					},
					async first() {
						return null
					},
					async all() {
						return { results: [] }
					}
				}
			}
		}
		const adapter = new D1WebAuthnAdapter(db as never)
		const first = {
			userId: 'owner-1',
			credentialId: 'credential-1',
			publicKey: 'key-1',
			counter: 0
		}
		await expect(adapter.createCredential(first)).resolves.toBe(true)
		await expect(
			adapter.createCredential({ ...first, userId: 'owner-2', publicKey: 'key-2' })
		).resolves.toBe(false)
		expect(credentials.get('credential-1')).toEqual({
			userId: 'owner-1',
			publicKey: 'key-1',
			counter: 0
		})
		await expect(
			adapter.advanceCredentialCounter({
				credentialId: 'credential-1',
				userId: 'owner-2',
				expectedCounter: 0,
				newCounter: 1
			})
		).resolves.toBe(false)
		await expect(
			adapter.advanceCredentialCounter({
				credentialId: 'credential-1',
				userId: 'owner-1',
				expectedCounter: 0,
				newCounter: 1
			})
		).resolves.toBe(true)
		await expect(
			adapter.advanceCredentialCounter({
				credentialId: 'credential-1',
				userId: 'owner-1',
				expectedCounter: 0,
				newCounter: 2
			})
		).resolves.toBe(false)
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

	it('atomically replaces D1 verification tokens and round-trips metadata', async () => {
		const db = createMockDb()
		const userAdapter = new D1UserAdapter(db)
		const user = await userAdapter.createUser({ email: 'replace@example.com', name: 'Replace' })
		const tokens = new D1VerificationTokenAdapter(db, {
			columns: { createdAt: 'created_at', metadata: 'metadata' }
		})

		await tokens.replaceForUserAndType({
			userId: user.id,
			type: 'mfa_login',
			token: 'first-token',
			expiresAt: new Date(Date.now() + 1000),
			metadata: { rememberMe: false }
		})
		await tokens.replaceForUserAndType({
			userId: user.id,
			type: 'mfa_login',
			token: 'second-token',
			expiresAt: new Date(Date.now() + 2000),
			metadata: { rememberMe: true }
		})

		await expect(
			tokens.findByToken({ token: 'first-token', type: 'mfa_login' })
		).resolves.toBeNull()
		await expect(
			tokens.findByToken({ token: 'second-token', type: 'mfa_login' })
		).resolves.toMatchObject({ token: { metadata: { rememberMe: true } } })
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
