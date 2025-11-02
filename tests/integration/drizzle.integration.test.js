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
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { pgTable, uuid, timestamp, text } from 'drizzle-orm/pg-core';
import { DrizzleSessionAdapter } from '../../src/adapters/session/drizzle.js';
import { DrizzleUserAdapter } from '../../src/adapters/database/drizzle.js';
import { DrizzleTokenAdapter } from '../../src/adapters/token/drizzle.js';

// Define test tables (should match your actual schema)
const users = pgTable('users', {
	id: uuid('id').primaryKey().defaultRandom(),
	email: text('email').notNull().unique(),
	name: text('name'),
	passwordHash: text('password_hash'),
	createdAt: timestamp('created_at').defaultNow(),
});

const sessions = pgTable('sessions', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	expiresAt: timestamp('expires_at').notNull(),
	createdAt: timestamp('created_at').defaultNow(),
});

const oauthTokens = pgTable('oauth_tokens', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	provider: text('provider').notNull(),
	tokens: text('tokens').notNull(),
	createdAt: timestamp('created_at').defaultNow(),
	updatedAt: timestamp('updated_at').defaultNow(),
});

describe('Drizzle Adapters Integration', () => {
	let db;
	let client;
	let sessionAdapter;
	let userAdapter;
	let tokenAdapter;
	let testUserId;

	beforeAll(async () => {
		// Connect to test database
		const connectionString = process.env.DATABASE_URL || 'postgresql://localhost/auth_test';
		client = postgres(connectionString);
		db = drizzle(client);

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
			encryptionKey: process.env.TOKEN_ENCRYPTION_KEY || 'test-key-32-chars-long-please!',
		});
	});

	afterAll(async () => {
		// Cleanup: delete test data
		if (testUserId) {
			await db.delete(sessions).where(eq(sessions.userId, testUserId));
			await db.delete(oauthTokens).where(eq(oauthTokens.userId, testUserId));
			await db.delete(users).where(eq(users.id, testUserId));
		}
		await client.end();
	});

	beforeEach(async () => {
		// Create a test user
		const [user] = await db.insert(users).values({
			email: `test-${Date.now()}@example.com`,
			name: 'Test User',
		}).returning();
		testUserId = user.id;
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
			const [createdUser] = await db.insert(users).values({
				email: 'findme@example.com',
				name: 'Find Me',
			}).returning();

			const foundUser = await userAdapter.getUserByEmail('findme@example.com');
			expect(foundUser).toBeDefined();
			expect(foundUser.id).toBe(createdUser.id);
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
