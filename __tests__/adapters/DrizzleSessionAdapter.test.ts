import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DrizzleSessionAdapter } from '../../src/adapters/session/DrizzleSessionAdapter.ts'
import { createMockDrizzleDb, drizzleSessionsTable, drizzleUsersTable } from '../drizzleTestKit.ts'

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
		expect(
			() => new DrizzleSessionAdapter(mockDb as never, { usersTable: drizzleUsersTable })
		).toThrow('DrizzleSessionAdapter requires sessionsTable and usersTable options')
		expect(
			() => new DrizzleSessionAdapter(mockDb as never, { sessionsTable: drizzleSessionsTable })
		).toThrow('DrizzleSessionAdapter requires sessionsTable and usersTable options')
	})

	it('creates sessions with expiry metadata', async () => {
		const mfaVerifiedAt = new Date('2026-07-14T12:00:00.000Z')
		const session = await adapter.createSession('user-123', { mfaVerifiedAt })

		expect(session.userId).toBe('user-123')
		expect(session.id).toBeTruthy()
		expect(session.expiresAt).toBeInstanceOf(Date)
		expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now())
		expect(session.mfaVerifiedAt).toEqual(mfaVerifiedAt)
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
		const mfaVerifiedAt = new Date('2026-07-14T12:00:00.000Z')
		mockDb.select = () => ({
			from: () => ({
				innerJoin: () => ({
					where: () =>
						Promise.resolve([
							{
								session: {
									id: 'session-123',
									userId: 'user-123',
									expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
									mfaVerifiedAt
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
		expect(result.session?.mfaVerifiedAt).toEqual(mfaVerifiedAt)
		expect(updated).toBe(true)
		expect(result.user?.email).toBe('test@example.com')
	})

	it('can map application profile fields from the joined session user row', async () => {
		mockDb.select = () => ({
			from: () => ({
				innerJoin: () => ({
					where: () => Promise.resolve([{
						session: {
							id: 'session-123',
							userId: 'user-123',
							expiresAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000)
						},
						user: {
							id: 'user-123',
							email: 'test@example.com',
							name: 'Test User',
							settings: { theme: 'dark' }
						}
					}])
				})
			})
		})
		const mapUser = vi.fn((row) => ({
			id: String(row?.['id']),
			email: String(row?.['email']),
			name: String(row?.['name']),
			avatar: null,
			emailVerified: true,
			settings: row?.['settings'] as Record<string, unknown>
		}))
		const mappedAdapter = new DrizzleSessionAdapter(mockDb as never, {
			sessionsTable: drizzleSessionsTable,
			usersTable: drizzleUsersTable,
			mapUser
		})

		const result = await mappedAdapter.validateSession('session-123')

		expect(mapUser).toHaveBeenCalledWith(expect.objectContaining({
			settings: { theme: 'dark' }
		}))
		expect(result.user?.settings).toEqual({ theme: 'dark' })
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

	it('persists a verifier instead of the returned bearer token', async () => {
		let inserted: Record<string, unknown> | undefined
		mockDb.insert = () => ({
			values: (values: Record<string, unknown>) => {
				inserted = values
				return Promise.resolve()
			}
		})
		const session = await adapter.createSession('u1')
		expect(inserted?.['id']).toEqual(expect.any(String))
		expect(inserted?.['id']).not.toBe(session.id)
	})
})
