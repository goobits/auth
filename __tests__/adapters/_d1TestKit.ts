export type TableRow = Record<string, unknown>
type Tables = Record<string, TableRow[]>
type RowPredicate = (row: TableRow) => boolean

export function createMockDb() {
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
