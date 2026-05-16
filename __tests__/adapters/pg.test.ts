import { describe, expect, it } from 'vitest'

import { createPgAuthAdapters, pgAuthSchemaSql, type PgPoolLike } from '../../src/adapters/pg/index.ts'

describe('pg auth adapters', () => {
	it('exposes the default postgres schema', () => {
		expect(pgAuthSchemaSql).toContain('CREATE TABLE IF NOT EXISTS auth_users')
		expect(pgAuthSchemaSql).toContain('CREATE TABLE IF NOT EXISTS auth_sessions')
		expect(pgAuthSchemaSql).toContain('CREATE TABLE IF NOT EXISTS auth_oauth_accounts')
	})

	it('creates sessions through a node-postgres compatible pool', async() => {
		const db: PgPoolLike = {
			async query(text, values = []) {
				if (text.includes('INSERT INTO auth_sessions')) {
					return {
						rows: [
							{
								created_at: new Date('2099-01-01T00:00:00.000Z'),
								expires_at: values[2],
								fingerprint: values[5] ?? null,
								id: values[0],
								ip: values[3] ?? null,
								last_active_at: null,
								user_agent: values[4] ?? null,
								user_id: values[1]
							}
						]
					}
				}
				throw new Error(`Unexpected query: ${ text }`)
			}
		}
		const adapters = createPgAuthAdapters({
			cookieName: 'auth',
			db,
			secureCookies: true
		})

		const session = await adapters.session.createSession('user-1', {
			fingerprint: 'fingerprint',
			ip: '127.0.0.1',
			userAgent: 'vitest'
		})

		expect(session.userId).toBe('user-1')
		expect(session.fingerprint).toBe('fingerprint')
	})
})
