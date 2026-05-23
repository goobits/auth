import { describe, expect, it } from 'vitest'

import { createPgAuthAdapters, pgAuthSchemaSql, type PgPoolLike } from '../../src/adapters/pg/index.ts'

describe('pg auth adapters', () => {
	it('exposes the default postgres schema', () => {
		expect(pgAuthSchemaSql).toContain('CREATE TABLE IF NOT EXISTS auth_users')
		expect(pgAuthSchemaSql).toContain('CREATE TABLE IF NOT EXISTS auth_sessions')
		expect(pgAuthSchemaSql).toContain('CREATE TABLE IF NOT EXISTS auth_oauth_accounts')
		expect(pgAuthSchemaSql).toContain('CREATE TABLE IF NOT EXISTS auth_webauthn_challenges')
		expect(pgAuthSchemaSql).toContain('CREATE TABLE IF NOT EXISTS auth_webauthn_credentials')
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

	it('creates WebAuthn challenges and credentials through the postgres bundle', async() => {
		const queries: Array<{ text: string; values: readonly unknown[] }> = []
		const db: PgPoolLike = {
			async query(text, values = []) {
				queries.push({ text, values })
				if (text.includes('SELECT * FROM auth_webauthn_challenges')) {
					return {
						rows: [
							{
								challenge: 'challenge',
								expires_at: new Date('2099-01-01T00:00:00.000Z'),
								id: values[0],
								type: 'registration',
								user_id: 'user-1'
							}
						]
					}
				}
				if (text.includes('SELECT * FROM auth_webauthn_credentials WHERE credential_id')) {
					return {
						rows: [
							{
								counter: 0,
								created_at: new Date('2026-01-01T00:00:00.000Z'),
								credential_id: values[0],
								name: 'Work laptop',
								public_key: 'public-key',
								transports: ['internal'],
								updated_at: new Date('2026-01-01T00:00:00.000Z'),
								user_id: 'user-1'
							}
						]
					}
				}
				return { rows: [] }
			}
		}
		const adapters = createPgAuthAdapters({
			cookieName: 'auth',
			db,
			secureCookies: true
		})

		await adapters.webauthn.createChallenge({
			challenge: 'challenge',
			challengeId: 'challenge-1',
			expiresAt: new Date('2099-01-01T00:00:00.000Z'),
			type: 'registration',
			userId: 'user-1'
		})
		await adapters.webauthn.createCredential({
			counter: 0,
			credentialId: 'credential-1',
			name: 'Work laptop',
			publicKey: 'public-key',
			transports: ['internal'],
			userId: 'user-1'
		})
		const challenge = await adapters.webauthn.getChallenge('challenge-1')
		const credential = await adapters.webauthn.getCredential('credential-1')

		expect(challenge?.id).toBe('challenge-1')
		expect(credential?.transports).toEqual(['internal'])
		expect(queries.some((query) => query.text.includes('INSERT INTO auth_webauthn_challenges'))).toBe(true)
		expect(queries.some((query) => query.text.includes('INSERT INTO auth_webauthn_credentials'))).toBe(true)
	})
})
