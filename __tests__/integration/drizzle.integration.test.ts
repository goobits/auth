/**
 * Integration Tests for Drizzle Adapters
 *
 * These tests verify that the adapters work correctly with a real Drizzle database.
 *
 * Setup required:
 * 1. PostgreSQL database for testing
 * 2. Environment variables: DATABASE_URL, TOKEN_ENCRYPTION_KEY
 * 3. Run migrations to create required tables
 *
 * To run these tests:
 * 1. Install dependencies: `npm install --save-dev vitest drizzle-orm postgres`
 * 2. Set up test database: `createdb auth_test`
 * 3. Run migrations: `drizzle-kit push`
 * 4. Run tests: `npx vitest run --testPathPattern=integration`
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { pgTable, uuid, timestamp, text, serial } from 'drizzle-orm/pg-core';
import { DrizzleSessionAdapter } from '../../src/adapters/session/drizzle.ts';
import { DrizzleUserAdapter } from '../../src/adapters/database/drizzle.ts';
import { DrizzleTokenAdapter } from '../../src/adapters/oauth-token/drizzle.ts';

// Define test tables (should match your actual schema)
const users = pgTable('users', {
	id: uuid('id').primaryKey().defaultRandom(),
	email: text('email').notNull().unique(),
	name: text('name'),
	passwordHash: text('password_hash'),
	createdAt: timestamp('created_at').defaultNow(),
});

const sessions = pgTable('sessions', {
	id: text('id').primaryKey(),
	userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	expiresAt: timestamp('expires_at').notNull(),
	createdAt: timestamp('created_at').defaultNow(),
});

const oauthTokens = pgTable('oauth_tokens', {
	id: serial('id').primaryKey(),
	userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	provider: text('provider').notNull(),
	tokens: text('tokens').notNull(),
	createdAt: timestamp('created_at').defaultNow(),
	updatedAt: timestamp('updated_at').defaultNow(),
});

describe('Drizzle Adapters Integration', () => {
	let db;
	let client;
	let dispose;
	let sessionAdapter;
	let userAdapter;
	let tokenAdapter;
	let testUserId;

	beforeAll(async () => {
		const connectionString = process.env.DATABASE_URL;

		if (connectionString) {
			const { drizzle } = await import('drizzle-orm/postgres-js');
			const postgres = (await import('postgres')).default;
			client = postgres(connectionString, { max: 1 });
			db = drizzle(client);

			await client`CREATE EXTENSION IF NOT EXISTS pgcrypto`;
			await client`CREATE TABLE IF NOT EXISTS users (
				id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
				email TEXT NOT NULL UNIQUE,
				name TEXT,
				password_hash TEXT,
				created_at TIMESTAMP DEFAULT now()
			)`;
			await client`CREATE TABLE IF NOT EXISTS sessions (
				id TEXT PRIMARY KEY,
				user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				expires_at TIMESTAMP NOT NULL,
				created_at TIMESTAMP DEFAULT now()
			)`;
			await client`CREATE TABLE IF NOT EXISTS oauth_tokens (
				id SERIAL PRIMARY KEY,
				user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				provider TEXT NOT NULL,
				tokens TEXT NOT NULL,
				created_at TIMESTAMP DEFAULT now(),
				updated_at TIMESTAMP DEFAULT now()
			)`;
			dispose = async () => {
				await client.end({ timeout: 5 });
			};
		} else {
			const { drizzle } = await import('drizzle-orm/pg-proxy');
			const { newDb } = await import('pg-mem');
			const dbMem = newDb();
			dbMem.public.registerFunction({
				name: 'gen_random_uuid',
				returns: 'uuid',
				implementation: () => randomUUID()
			});
			dbMem.public.none(`
				CREATE TABLE users (
					id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
					email TEXT NOT NULL UNIQUE,
					name TEXT,
					password_hash TEXT,
					created_at TIMESTAMP DEFAULT now()
				);
				CREATE TABLE sessions (
					id TEXT PRIMARY KEY,
					user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
					expires_at TIMESTAMP NOT NULL,
					created_at TIMESTAMP DEFAULT now()
				);
				CREATE TABLE oauth_tokens (
					id SERIAL PRIMARY KEY,
					user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
					provider TEXT NOT NULL,
					tokens TEXT NOT NULL,
					created_at TIMESTAMP DEFAULT now(),
					updated_at TIMESTAMP DEFAULT now()
				);
			`);
			const toLiteral = (value) => {
				if (value === null || value === undefined) return 'null';
				if (value instanceof Date) return `'${value.toISOString()}'`;
				if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'null';
				if (typeof value === 'boolean') return value ? 'true' : 'false';
				if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
				if (Array.isArray(value)) {
					return `ARRAY[${value.map((item) => toLiteral(item)).join(', ')}]`;
				}
				return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
			};

			const formatSql = (sql, params) => {
				let formatted = sql;
				params.forEach((value, index) => {
					const literal = toLiteral(value);
					const pattern = new RegExp(`\\$${index + 1}(?!\\d)`, 'g');
					formatted = formatted.replace(pattern, literal);
				});
				return formatted;
			};

			db = drizzle(async (sql, params = []) => {
				const formatted = formatSql(sql, params);
				const result = dbMem.public.query(formatted);
				const rows = result.rows.map((row) => {
					const nameCounts = {};
					return result.fields.map((field) => {
						const baseName = field.name;
						const index = nameCounts[baseName] ?? 0;
						nameCounts[baseName] = index + 1;
						const key = index === 0 ? baseName : `${baseName}${index}`;
						return row[key];
					});
				});
				return { rows };
			});
			dispose = async () => {};
		}

		// Create adapters
		sessionAdapter = new DrizzleSessionAdapter(db, {
			sessionsTable: sessions,
			usersTable: users,
			sessionLifetime: 30 * 24 * 60 * 60 * 1000,
		});

		userAdapter = new DrizzleUserAdapter(db, {
			usersTable: users,
		});

		tokenAdapter = new DrizzleTokenAdapter(db, {
			tokensTable: oauthTokens,
			encryptionKey:
				process.env.TOKEN_ENCRYPTION_KEY ||
				'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
		});
	});

	afterAll(async () => {
		// Cleanup: delete test data
		if (testUserId) {
			await db.delete(sessions).where(eq(sessions.userId, testUserId));
			await db.delete(oauthTokens).where(eq(oauthTokens.userId, testUserId));
			await db.delete(users).where(eq(users.id, testUserId));
		}
		if (dispose) await dispose();
	});

	beforeEach(async () => {
		// Create a test user
		const userId = randomUUID();
		await db.insert(users).values({
			id: userId,
			email: `test-${Date.now()}@example.com`,
			name: 'Test User',
		});
		testUserId = userId;
	});

	describe('Session Adapter Integration', () => {
		it('should create and validate a session', async () => {
			// Create session
			const session = await sessionAdapter.createSession(testUserId);
			expect(session).toBeDefined();
			expect(session.id).toBeDefined();
			expect(session.userId).toBe(testUserId);

			// Validate session
			const { session: validatedSession, user } = await sessionAdapter.validateSession(session.id);
			expect(validatedSession).toBeDefined();
			expect(validatedSession.id).toBe(session.id);
			expect(user).toBeDefined();
			expect(user.id).toBe(testUserId);
		});

		it('should invalidate a session', async () => {
			const session = await sessionAdapter.createSession(testUserId);

			// Invalidate
			await sessionAdapter.invalidateSession(session.id);

			// Should no longer be valid
			const { session: validatedSession } = await sessionAdapter.validateSession(session.id);
			expect(validatedSession).toBeNull();
		});

		it('should extend session expiration when fresh', async () => {
			const session = await sessionAdapter.createSession(testUserId);
			const originalExpiry = session.expiresAt;

			// Wait a bit
			await new Promise(resolve => setTimeout(resolve, 100));

			// Validate should extend if fresh
			const { session: validatedSession } = await sessionAdapter.validateSession(session.id);
			if (validatedSession.fresh) {
				expect(validatedSession.expiresAt.getTime()).toBeGreaterThan(originalExpiry.getTime());
			}
		});
	});

	describe('User Adapter Integration', () => {
		it('should get user by email', async () => {
			const userId = randomUUID();
			await db.insert(users).values({
				id: userId,
				email: 'findme@example.com',
				name: 'Find Me',
			});

			const foundUser = await userAdapter.getUserByEmail('findme@example.com');
			expect(foundUser).toBeDefined();
			expect(foundUser.id).toBe(userId);
			expect(foundUser.email).toBe('findme@example.com');
		});

		it('should get user by ID', async () => {
			const user = await userAdapter.getUserById(testUserId);
			expect(user).toBeDefined();
			expect(user.id).toBe(testUserId);
		});

		it('should return null for non-existent user', async () => {
			const user = await userAdapter.getUserByEmail('nonexistent@example.com');
			expect(user).toBeNull();
		});
	});

	describe('Token Adapter Integration', () => {
		it('should store and retrieve OAuth tokens', async () => {
			const tokens = {
				accessToken: 'access-token-123',
				refreshToken: 'refresh-token-123',
				accessTokenExpiresAt: new Date(Date.now() + 3600 * 1000),
			};

			// Store tokens
			await tokenAdapter.storeTokens(testUserId, 'google', tokens);

			// Retrieve tokens
			const retrieved = await tokenAdapter.getTokens(testUserId, 'google');
			expect(retrieved).toBeDefined();
			expect(retrieved.accessToken).toBe(tokens.accessToken);
			expect(retrieved.refreshToken).toBe(tokens.refreshToken);
		});

		it('should encrypt tokens in database', async () => {
			const tokens = {
				accessToken: 'secret-access-token',
				refreshToken: 'secret-refresh-token',
			};

			await tokenAdapter.storeTokens(testUserId, 'google', tokens);

			// Query raw tokens from database
			const [row] = await db.select().from(oauthTokens)
				.where(eq(oauthTokens.userId, testUserId));

			// Raw tokens should be encrypted (not plain text)
			expect(row.tokens).not.toContain('secret-access-token');
			expect(row.tokens).not.toContain('secret-refresh-token');
		});

		it('should delete tokens', async () => {
			await tokenAdapter.storeTokens(testUserId, 'google', {
				accessToken: 'token-123',
			});

			await tokenAdapter.deleteTokens(testUserId, 'google');

			const tokens = await tokenAdapter.getTokens(testUserId, 'google');
			expect(tokens).toBeNull();
		});
	});

	describe('Full Authentication Flow', () => {
		it('should complete OAuth flow with token storage and session creation', async () => {
			// 1. Store OAuth tokens (after OAuth callback)
			const oauthTokens = {
				accessToken: 'google-access-token',
				refreshToken: 'google-refresh-token',
				accessTokenExpiresAt: new Date(Date.now() + 3600 * 1000),
				scope: 'openid profile email',
			};
			await tokenAdapter.storeTokens(testUserId, 'google', oauthTokens);

			// 2. Create session
			const session = await sessionAdapter.createSession(testUserId);

			// 3. Validate session and get user
			const { session: validSession, user } = await sessionAdapter.validateSession(session.id);
			expect(validSession).toBeDefined();
			expect(user).toBeDefined();
			expect(user.id).toBe(testUserId);

			// 4. Retrieve OAuth tokens
			const storedTokens = await tokenAdapter.getTokens(testUserId, 'google');
			expect(storedTokens.accessToken).toBe(oauthTokens.accessToken);

			// 5. Logout: invalidate session and delete tokens
			await sessionAdapter.invalidateSession(session.id);
			await tokenAdapter.deleteTokens(testUserId, 'google');

			// 6. Verify cleanup
			const { session: deletedSession } = await sessionAdapter.validateSession(session.id);
			expect(deletedSession).toBeNull();

			const deletedTokens = await tokenAdapter.getTokens(testUserId, 'google');
			expect(deletedTokens).toBeNull();
		});
	});
});
