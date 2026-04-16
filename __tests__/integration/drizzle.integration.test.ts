import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { DrizzleSessionAdapter } from '../../src/adapters/session/drizzle.ts'
import { DrizzleUserAdapter } from '../../src/adapters/database/drizzle.ts'
import { DrizzleTokenAdapter } from '../../src/adapters/oauth-token/drizzle.ts'
import {
	createIntegrationDrizzleFixture,
	drizzleOauthTokensTable,
	drizzleSessionsTable,
	drizzleUsersTable
} from '../drizzle-test-kit.ts'

describe('Drizzle Adapters Integration', () => {
	let db: any
	let dispose: () => Promise<void>
	let sessionAdapter: DrizzleSessionAdapter
	let userAdapter: DrizzleUserAdapter
	let tokenAdapter: DrizzleTokenAdapter
	let testUserId = ''

	beforeAll(async () => {
		const fixture = await createIntegrationDrizzleFixture()
		db = fixture.db
		dispose = fixture.dispose

		sessionAdapter = new DrizzleSessionAdapter(db, {
			sessionsTable: drizzleSessionsTable,
			usersTable: drizzleUsersTable,
			sessionLifetime: 30 * 24 * 60 * 60 * 1000
		})

		userAdapter = new DrizzleUserAdapter(db, {
			usersTable: drizzleUsersTable
		})

		tokenAdapter = new DrizzleTokenAdapter(db, {
			tokensTable: drizzleOauthTokensTable,
			encryptionKey:
				process.env.TOKEN_ENCRYPTION_KEY ||
				'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
		})
	})

	afterAll(async () => {
		if (testUserId) {
			await db.delete(drizzleSessionsTable).where(eq(drizzleSessionsTable.userId, testUserId))
			await db.delete(drizzleOauthTokensTable).where(eq(drizzleOauthTokensTable.userId, testUserId))
			await db.delete(drizzleUsersTable).where(eq(drizzleUsersTable.id, testUserId))
		}
		await dispose()
	})

	beforeEach(async () => {
		testUserId = randomUUID()
		await db.insert(drizzleUsersTable).values({
			id: testUserId,
			email: `test-${Date.now()}@example.com`,
			name: 'Test User'
		})
	})

	it('creates and validates a session', async () => {
		const session = await sessionAdapter.createSession(testUserId)

		expect(session.id).toBeDefined()
		expect(session.userId).toBe(testUserId)

		const { session: validatedSession, user } = await sessionAdapter.validateSession(session.id)
		expect(validatedSession?.id).toBe(session.id)
		expect(user?.id).toBe(testUserId)
	})

	it('invalidates a session', async () => {
		const session = await sessionAdapter.createSession(testUserId)
		await sessionAdapter.invalidateSession(session.id)

		const { session: validatedSession } = await sessionAdapter.validateSession(session.id)
		expect(validatedSession).toBeNull()
	})

	it('gets a user by email and id', async () => {
		const byId = await userAdapter.getUserById(testUserId)
		const byEmail = await userAdapter.getUserByEmail(byId?.email || '')

		expect(byId?.id).toBe(testUserId)
		expect(byEmail?.id).toBe(testUserId)
	})

	it('stores encrypted OAuth tokens and deletes them', async () => {
		const tokens = {
			accessToken: 'secret-access-token',
			refreshToken: 'secret-refresh-token',
			accessTokenExpiresAt: new Date(Date.now() + 3600 * 1000)
		}

		await tokenAdapter.storeTokens(testUserId, 'google', tokens)

		const retrieved = await tokenAdapter.getTokens(testUserId, 'google')
		expect(retrieved?.accessToken).toBe(tokens.accessToken)
		expect(retrieved?.refreshToken).toBe(tokens.refreshToken)

		const [row] = await db
			.select()
			.from(drizzleOauthTokensTable)
			.where(eq(drizzleOauthTokensTable.userId, testUserId))
		expect(row.tokens).not.toContain('secret-access-token')
		expect(row.tokens).not.toContain('secret-refresh-token')

		await tokenAdapter.deleteTokens(testUserId, 'google')
		expect(await tokenAdapter.getTokens(testUserId, 'google')).toBeNull()
	})
})
