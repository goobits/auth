import { describe, it, expect } from 'vitest'
import { D1UserAdapter } from '../../src/adapters/database/d1.ts'
import { D1SessionAdapter } from '../../src/adapters/session/d1.ts'
import { D1TokenAdapter } from '../../src/adapters/oauth-token/d1.ts'
import { D1VerificationTokenAdapter } from '../../src/adapters/verification-token/d1.ts'

type TableRow = Record<string, unknown>
type Tables = Record<string, TableRow[]>
type RowPredicate = (row: TableRow) => boolean

function createMockDb() {
	const tables: Tables = {
		users: [],
		sessions: [],
		oauth_accounts: [],
		oauth_tokens: [],
		verification_tokens: [],
	};
	let lastRowId = 0;

	function insert(table: string, row: TableRow) {
		if (!tables[table]) tables[table] = [];
		const id = ++lastRowId;
		const data = { ...row };
		if (!('id' in data)) data.id = id;
		tables[table].push(data);
		return { last_row_id: data.id };
	}

	function deleteWhere(table: string, fn: RowPredicate) {
		if (!tables[table]) tables[table] = [];
		tables[table] = tables[table].filter((row) => !fn(row));
	}

	function updateWhere(
		table: string,
		fn: RowPredicate,
		updates: TableRow,
	) {
		if (!tables[table]) tables[table] = [];
		for (const row of tables[table]) {
			if (fn(row)) Object.assign(row, updates);
		}
	}

	function findWhere(table: string, fn: RowPredicate) {
		if (!tables[table]) tables[table] = [];
		return tables[table].find(fn) || null;
	}

	function findAll(table: string, fn: RowPredicate) {
		if (!tables[table]) tables[table] = [];
		return tables[table].filter(fn);
	}

	return {
		prepare(sql: string) {
			let bound: unknown[] = [];
			return {
				bind(...args: unknown[]) { bound = args; return this; },
				run() {
					if (sql.startsWith('INSERT INTO users')) {
						const [email, name, avatar, emailVerified] = bound;
						return { meta: insert('users', { email, name, avatar, email_verified: emailVerified }) };
					}
					if (sql.startsWith('INSERT INTO oauth_accounts')) {
						const [user_id, provider, provider_account_id] = bound;
						return { meta: insert('oauth_accounts', { user_id, provider, provider_account_id }) };
					}
					if (sql.startsWith('INSERT INTO sessions')) {
						const [id, user_id, expires_at] = bound;
						return { meta: insert('sessions', { id, user_id, expires_at }) };
					}
					if (sql.startsWith('UPDATE sessions SET')) {
						const [expires_at, id] = bound;
						updateWhere('sessions', (r) => r.id === id, { expires_at });
						return { meta: { changes: 1 } };
					}
					if (sql.startsWith('DELETE FROM sessions')) {
						const [value] = bound;
						if (sql.includes('user_id')) {
							deleteWhere('sessions', (r) => r.user_id === value);
						} else {
							deleteWhere('sessions', (r) => r.id === value);
						}
						return { meta: { changes: 1 } };
					}
					if (sql.startsWith('DELETE FROM oauth_tokens')) {
						const [user_id, provider] = bound;
						deleteWhere('oauth_tokens', (r) => r.user_id === user_id && r.provider === provider);
						return { meta: { changes: 1 } };
					}
					if (sql.startsWith('INSERT INTO oauth_tokens')) {
						const [user_id, provider, tokens] = bound;
						return { meta: insert('oauth_tokens', { user_id, provider, tokens }) };
					}
					if (sql.startsWith('INSERT INTO verification_tokens')) {
						const [id, user_id, type, token, expires_at] = bound;
						return { meta: insert('verification_tokens', { id, user_id, type, token, expires_at }) };
					}
					if (sql.startsWith('DELETE FROM verification_tokens')) {
						if (sql.includes('id = ?')) {
							const [id] = bound;
							deleteWhere('verification_tokens', (r) => r.id === id);
						} else {
							const [user_id, type] = bound;
							deleteWhere('verification_tokens', (r) => r.user_id === user_id && r.type === type);
						}
						return { meta: { changes: 1 } };
					}
					return { meta: { changes: 0 } };
				},
				first() {
					if (sql.includes('FROM users') && sql.includes('WHERE id')) {
						const [id] = bound;
						return findWhere('users', (r) => r.id === id);
					}
					if (sql.includes('FROM users') && sql.includes('WHERE email')) {
						const [email] = bound;
						return findWhere('users', (r) => r.email === email);
					}
					if (sql.includes('FROM oauth_accounts')) {
						const [provider, provider_account_id] = bound;
						const acct = findWhere('oauth_accounts', (r) => r.provider === provider && r.provider_account_id === provider_account_id);
						if (!acct) return null;
						return findWhere('users', (r) => r.id === acct.user_id);
					}
					if (sql.includes('FROM sessions') && sql.includes('JOIN users')) {
						const [id] = bound;
						const session = findWhere('sessions', (r) => r.id === id);
						if (!session) return null;
						const user = findWhere('users', (r) => r.id === session.user_id);
						return { ...user, session_id: session.id, user_id: session.user_id, expires_at: session.expires_at };
					}
					if (sql.includes('FROM oauth_tokens')) {
						const [user_id, provider] = bound;
						return findWhere('oauth_tokens', (r) => r.user_id === user_id && r.provider === provider) || null;
					}
					if (sql.includes('FROM verification_tokens') && sql.includes('JOIN users')) {
						const [token, type] = bound;
						const vt = findWhere('verification_tokens', (r) => r.token === token && r.type === type);
						if (!vt) return null;
						const user = findWhere('users', (r) => r.id === vt.user_id);
						return { ...vt, ...user };
					}
					return null;
				},
				all() {
					if (sql.includes('FROM oauth_tokens')) {
						const [user_id] = bound;
						return { results: findAll('oauth_tokens', (r) => r.user_id === user_id) };
					}
					return { results: [] };
				},
			};
		},
	};
}

describe('D1 adapters', () => {
	it('creates user and session and validates', async () => {
		const db = createMockDb();
		const userAdapter = new D1UserAdapter(db);
		const sessionAdapter = new D1SessionAdapter(db, { sessionLifetime: 1000, sessionRefreshThreshold: 500 });

		const user = await userAdapter.createUser({ email: 'a@b.com', name: 'A', verified_email: true });
		const session = await sessionAdapter.createSession(user.id);
		const result = await sessionAdapter.validateSession(session.id);
		expect(result.user?.email).toBe('a@b.com');
		expect(result.session?.id).toBe(session.id);
	});

	it('stores and retrieves oauth tokens', async () => {
		const db = createMockDb();
		const tokenAdapter = new D1TokenAdapter(db, { encryptionKey: 'a'.repeat(64) });
		await tokenAdapter.storeTokens('1', 'google', {
			accessToken: 'x',
			refreshToken: null,
			scope: null,
			accessTokenExpiresAt: new Date().toISOString()
		});
		const tokens = await tokenAdapter.getTokens('1', 'google');
		expect(tokens?.accessToken).toBe('x');
	});

	it('creates and finds verification tokens', async () => {
		const db = createMockDb();
		const userAdapter = new D1UserAdapter(db);
		const user = await userAdapter.createUser({ email: 'c@d.com', name: 'C' });
		const tokens = new D1VerificationTokenAdapter(db);
		await tokens.create({ userId: user.id, type: 'email_verification', token: 't', expiresAt: new Date(Date.now() + 1000) });
		const record = await tokens.findByToken({ token: 't', type: 'email_verification' });
		expect(record?.user?.email).toBe('c@d.com');
	});
});
