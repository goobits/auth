/**
 * Unit Tests for DrizzleSessionAdapter
 *
 * These tests verify the session management functionality of the Drizzle adapter.
 *
 * To run these tests:
 * 1. Install vitest: `npm install --save-dev vitest`
 * 2. Run: `npx vitest run` or `npx vitest watch`
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DrizzleSessionAdapter } from '../../src/adapters/session/drizzle.ts';

type AdapterInternals = {
	db: unknown;
	sessionsTable: unknown;
	usersTable: unknown;
	sessionLifetime: number;
}

describe('DrizzleSessionAdapter', () => {
	let adapter: DrizzleSessionAdapter;
	let mockDb: Record<string, () => unknown>;
	let mockSessionsTable: Record<string, string>;
	let mockUsersTable: Record<string, string>;

	beforeEach(() => {
		// Mock database and tables
		mockSessionsTable = {
			id: 'sessions',
			name: 'sessions',
		};
		mockUsersTable = {
			id: 'users',
			name: 'users',
		};

		// Mock database with query methods
		mockDb = {
			select: () => ({
				from: () => ({
					innerJoin: () => ({
						where: () => Promise.resolve([]),
					}),
				}),
			}),
			insert: () => ({
				values: () => ({
					returning: () => Promise.resolve([{ id: 'session-123', userId: 'user-123', expiresAt: new Date() }]),
				}),
			}),
			delete: () => ({
				where: () => Promise.resolve(),
			}),
			update: () => ({
				set: () => ({
					where: () => Promise.resolve(),
				}),
			}),
		};

		adapter = new DrizzleSessionAdapter(mockDb, {
			sessionsTable: mockSessionsTable,
			usersTable: mockUsersTable,
			sessionLifetime: 30 * 24 * 60 * 60 * 1000, // 30 days
			sessionRefreshThreshold: 15 * 24 * 60 * 60 * 1000, // 15 days
		});
	});

	describe('constructor', () => {
		it('should create adapter with required options', () => {
			const internals = adapter as unknown as AdapterInternals;
			expect(adapter).toBeDefined();
			expect(internals.db).toBe(mockDb);
			expect(internals.sessionsTable).toBe(mockSessionsTable);
			expect(internals.usersTable).toBe(mockUsersTable);
		});

		it('should throw error if sessionsTable is missing', () => {
			expect(() => {
				new DrizzleSessionAdapter(mockDb, { usersTable: mockUsersTable });
			}).toThrow('DrizzleSessionAdapter requires sessionsTable and usersTable options');
		});

		it('should throw error if usersTable is missing', () => {
			expect(() => {
				new DrizzleSessionAdapter(mockDb, { sessionsTable: mockSessionsTable });
			}).toThrow('DrizzleSessionAdapter requires sessionsTable and usersTable options');
		});

		it('should use default session lifetime', () => {
			const defaultAdapter = new DrizzleSessionAdapter(mockDb, {
				sessionsTable: mockSessionsTable,
				usersTable: mockUsersTable,
			});
			const internals = defaultAdapter as unknown as AdapterInternals;
			expect(internals.sessionLifetime).toBe(30 * 24 * 60 * 60 * 1000);
		});

		it('should use custom session lifetime', () => {
			const customLifetime = 7 * 24 * 60 * 60 * 1000; // 7 days
			const customAdapter = new DrizzleSessionAdapter(mockDb, {
				sessionsTable: mockSessionsTable,
				usersTable: mockUsersTable,
				sessionLifetime: customLifetime,
			});
			const internals = customAdapter as unknown as AdapterInternals;
			expect(internals.sessionLifetime).toBe(customLifetime);
		});
	});

	describe('createSession', () => {
		it('should create a new session', async () => {
			const userId = 'user-123';
			const session = await adapter.createSession(userId);

			expect(session).toBeDefined();
			expect(session.userId).toBe(userId);
			expect(session.id).toBeDefined();
			expect(session.expiresAt).toBeInstanceOf(Date);
		});

		it('should create session with correct expiration', async () => {
			const session = await adapter.createSession('user-123');
			const now = Date.now();
			const expiresAt = session.expiresAt.getTime();
			const internals = adapter as unknown as AdapterInternals;

			// Should expire in ~30 days (within 1 minute tolerance)
			const expectedExpiry = now + internals.sessionLifetime;
			expect(Math.abs(expiresAt - expectedExpiry)).toBeLessThan(60 * 1000);
		});
	});

	describe('validateSession', () => {
		it('should validate a valid session', async () => {
			// Mock a valid session
			mockDb.select = () => ({
				from: () => ({
					innerJoin: () => ({
						where: () => Promise.resolve([{
							session: {
								id: 'session-123',
								userId: 'user-123',
								expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
								fresh: false,
							},
							user: { id: 'user-123', email: 'test@example.com' },
						}]),
					}),
				}),
			});

			const result = await adapter.validateSession('session-123');
			expect(result.session).toBeDefined();
			expect(result.user).toBeDefined();
			expect(result.session.id).toBe('session-123');
		});

		it('should return null for expired session', async () => {
			// Mock an expired session
			mockDb.select = () => ({
				from: () => ({
					innerJoin: () => ({
						where: () => Promise.resolve([{
							session: {
								id: 'session-123',
								userId: 'user-123',
								expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
							},
							user: { id: 'user-123', email: 'test@example.com' },
						}]),
					}),
				}),
			});

			const result = await adapter.validateSession('session-123');
			expect(result.session).toBeNull();
			expect(result.user).toBeNull();
		});

		it('should return null for non-existent session', async () => {
			mockDb.select = () => ({
				from: () => ({
					innerJoin: () => ({
						where: () => Promise.resolve([]),
					}),
				}),
			});

			const result = await adapter.validateSession('non-existent');
			expect(result.session).toBeNull();
			expect(result.user).toBeNull();
		});

		it('should mark session as fresh when near expiration', async () => {
			// Mock a session that's 20 days old (needs refresh)
			const expiresAt = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
			mockDb.select = () => ({
				from: () => ({
					innerJoin: () => ({
						where: () => Promise.resolve([{
							session: {
								id: 'session-123',
								userId: 'user-123',
								expiresAt,
								fresh: false,
							},
							user: { id: 'user-123', email: 'test@example.com' },
						}]),
					}),
				}),
			});

			const result = await adapter.validateSession('session-123');
			expect(result.session.fresh).toBe(true);
		});
	});

	describe('invalidateSession', () => {
		it('should delete a session', async () => {
			let deleteCalled = false;
			mockDb.delete = () => ({
				where: () => {
					deleteCalled = true;
					return Promise.resolve();
				},
			});

			await adapter.invalidateSession('session-123');
			expect(deleteCalled).toBe(true);
		});
	});

	describe('cookie management', () => {
		it('should set session cookie with correct attributes', () => {
			const mockCookies = {
				set: vi.fn(),
			};
			const session = {
				id: 'session-123',
				expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
			};

			adapter.setSessionCookie(mockCookies, session);

			expect(mockCookies.set).toHaveBeenCalledWith(
				'session',
				'session-123',
				expect.objectContaining({
					httpOnly: true,
					sameSite: 'lax',
					path: '/',
				})
			);
		});

		it('should delete session cookie', () => {
			const mockCookies = {
				delete: vi.fn(),
			};

			adapter.deleteSessionCookie(mockCookies);

			expect(mockCookies.delete).toHaveBeenCalledWith(
				'session',
				expect.objectContaining({
					path: '/',
				})
			);
		});
	});

	describe('listSessions', () => {
		it('should list sessions for a user', async () => {
			const now = new Date();
			mockDb.select = () => ({
				from: () => ({
					where: () =>
						Promise.resolve([{ id: 's1', userId: 'u1', expiresAt: now }]),
				}),
			});

			const sessions = await adapter.listSessions('u1');
			expect(sessions).toHaveLength(1);
			expect(sessions[0].userId).toBe('u1');
		});
	});
});
