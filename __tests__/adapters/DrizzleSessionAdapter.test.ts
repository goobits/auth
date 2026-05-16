import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DrizzleSessionAdapter } from '../../src/adapters/session/drizzle.ts'
import { createMockDrizzleDb, drizzleSessionsTable, drizzleUsersTable } from '../drizzle-test-kit.ts'

describe('DrizzleSessionAdapter', () => {
	let adapter: DrizzleSessionAdapter
	let mockDb: ReturnType<typeof createMockDrizzleDb>

	beforeEach(() => {
		mockDb = createMockDrizzleDb()
		adapter = new DrizzleSessionAdapter(mockDb as never, {
			sessionsTable: drizzleSessionsTable,
			usersTable: drizzleUsersTable,
			sessionLifetime: 30 * 24 * 60 * 60 * 1000,
			sessionRefreshThreshold: 15 * 24 * 60 * 60 * 1000,
			secureCookies: false
		})
	})

	it('requires sessions and users tables', () => {
		expect(() => new DrizzleSessionAdapter(mockDb as never, { usersTable: drizzleUsersTable })).toThrow(
			'DrizzleSessionAdapter requires sessionsTable and usersTable options'
		)
		expect(() => new DrizzleSessionAdapter(mockDb as never, { sessionsTable: drizzleSessionsTable })).toThrow(
			'DrizzleSessionAdapter requires sessionsTable and usersTable options'
		)
	})

	it('creates sessions with expiry metadata', async () => {
		const session = await adapter.createSession('user-123')

		expect(session.userId).toBe('user-123')
		expect(session.id).toBeTruthy()
		expect(session.expiresAt).toBeInstanceOf(Date)
		expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now())
	})

	it('returns null when no session row exists', async () => {
		const result = await adapter.validateSession('missing')
		expect(result).toEqual({ session: null, user: null })
	})

	it('deletes expired sessions during validation', async () => {
		let deleted = false
		mockDb.select = () => ({
			from: () => ({
				innerJoin: () => ({
					where: () =>
						Promise.resolve([
							{
								session: {
									id: 'session-123',
									userId: 'user-123',
									expiresAt: new Date(Date.now() - 60_000)
								},
								user: { id: 'user-123', email: 'test@example.com', name: 'Test User' }
							}
						])
				})
			})
		})
		mockDb.delete = () => ({
			where: (_condition: unknown) => {
				deleted = true
				return Promise.resolve()
			}
		})

		const result = await adapter.validateSession('session-123')
		expect(result).toEqual({ session: null, user: null })
		expect(deleted).toBe(true)
	})

	it('marks near-expiry sessions as fresh and extends expiry', async () => {
		let updated = false
		mockDb.select = () => ({
			from: () => ({
				innerJoin: () => ({
					where: () =>
						Promise.resolve([
							{
								session: {
									id: 'session-123',
									userId: 'user-123',
									expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
								},
								user: { id: 'user-123', email: 'test@example.com', name: 'Test User' }
							}
						])
				})
			})
		})
		mockDb.update = () => ({
			set: (values: { expiresAt: Date }) => ({
				where: () => {
					updated = values.expiresAt instanceof Date
					return Promise.resolve()
				}
			})
		})

		const result = await adapter.validateSession('session-123')
		expect(result.session?.fresh).toBe(true)
		expect(updated).toBe(true)
		expect(result.user?.email).toBe('test@example.com')
	})

	it('sets and clears cookies with expected attributes', async () => {
		const cookies = {
			set: vi.fn(),
			delete: vi.fn()
		}
		const session = await adapter.createSession('user-123')

		adapter.setSessionCookie(cookies as never, session)
		expect(cookies.set).toHaveBeenCalledWith(
			'session',
			session.id,
			expect.objectContaining({ httpOnly: true, secure: false, sameSite: 'lax', path: '/' })
		)

		adapter.deleteSessionCookie(cookies as never)
		expect(cookies.delete).toHaveBeenCalledWith('session', expect.objectContaining({ path: '/' }))
	})

	it('lists sessions for a user', async () => {
		mockDb.select = () => ({
			from: () => ({
				where: () =>
					Promise.resolve([{ id: 's1', userId: 'u1', expiresAt: new Date(Date.now() + 60_000) }])
			})
		})

		const sessions = await adapter.listSessions('u1')
		expect(sessions).toHaveLength(1)
		expect(sessions[0]?.userId).toBe('u1')
	})
})
