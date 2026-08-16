import { describe, expect, it } from 'vitest'

import { createPgAuthAdapters, type PgPoolLike } from '../../src/adapters/pg/index.ts'
import { mfaSecretCodec } from './_pgTestKit.ts'

describe('pg session and WebAuthn adapters', () => {
	it('omits the optional MFA capability when no secret codec is supplied', () => {
		const db: PgPoolLike = { query: async () => ({ rows: [] }) }
		const adapters = createPgAuthAdapters({
			cookieName: 'auth',
			db,
			secureCookies: true
		})

		expect(adapters.mfa).toBeUndefined()
		expect('mfa' in adapters).toBe(false)
	})

	it('creates sessions through a node-postgres compatible pool', async () => {
		let storedSessionId = ''
		const db: PgPoolLike = {
			async query(text, values = []) {
				if (text.includes('INSERT INTO auth_sessions')) {
					storedSessionId = String(values[0])
					return {
						rows: [
							{
								created_at: new Date('2099-01-01T00:00:00.000Z'),
								expires_at: values[2],
								fingerprint: values[5] ?? null,
								id: values[0],
								ip: values[3] ?? null,
								last_active_at: null,
								mfa_verified_at: values[6] ?? null,
								user_agent: values[4] ?? null,
								user_id: values[1]
							}
						]
					}
				}
				throw new Error(`Unexpected query: ${text}`)
			}
		}
		const adapters = createPgAuthAdapters({
			cookieName: 'auth',
			db,
			mfaSecretCodec,
			secureCookies: true,
			sessionLifetimeMs: 60_000
		})

		const mfaVerifiedAt = new Date('2026-07-14T12:00:00.000Z')
		const session = await adapters.session.createSession('user-1', {
			fingerprint: 'fingerprint',
			ip: '127.0.0.1',
			mfaVerifiedAt,
			userAgent: 'vitest'
		})

		expect(session.userId).toBe('user-1')
		expect(session.fingerprint).toBe('fingerprint')
		expect(session.mfaVerifiedAt).toEqual(mfaVerifiedAt)
		expect(session.expiresAt.getTime() - Date.now()).toBeGreaterThan(59_000)
		expect(session.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(60_000)
		expect(storedSessionId).not.toBe(session.id)
	})

	it('creates WebAuthn challenges and credentials through the postgres bundle', async () => {
		const queries: Array<{ text: string; values: readonly unknown[] }> = []
		const db: PgPoolLike = {
			async query(text, values = []) {
				queries.push({ text, values })
				if (text.includes('INSERT INTO auth_webauthn_credentials')) {
					return { rows: [{ credential_id: values[1] }] }
				}
				if (text.includes('SELECT * FROM auth_webauthn_challenges')) {
					return {
						rows: [
							{
								challenge: 'challenge',
								expires_at: new Date('2099-01-01T00:00:00.000Z'),
								id: values[0],
								type: 'registration',
								user_id: 42
							}
						]
					}
				}
				if (text.includes('SELECT * FROM auth_webauthn_credentials WHERE credential_id')) {
					return {
						rows: [
							{
								counter: '4294967295',
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
			mfaSecretCodec,
			secureCookies: true
		})

		await adapters.webauthn.createChallenge({
			challenge: 'challenge',
			challengeId: 'challenge-1',
			expiresAt: new Date('2099-01-01T00:00:00.000Z'),
			type: 'registration',
			userId: 'user-1'
		})
		await expect(
			adapters.webauthn.createCredential({
				counter: 0,
				credentialId: 'credential-1',
				name: 'Work laptop',
				publicKey: 'public-key',
				transports: ['internal'],
				userId: 'user-1'
			})
		).resolves.toBe(true)
		const challenge = await adapters.webauthn.getChallenge('challenge-1')
		const credential = await adapters.webauthn.getCredential('credential-1')

		expect(challenge?.id).toBe('challenge-1')
		expect(challenge?.userId).toBe('42')
		expect(credential?.counter).toBe(4_294_967_295)
		expect(credential?.transports).toEqual(['internal'])
		expect(
			queries.some((query) => query.text.includes('INSERT INTO auth_webauthn_challenges'))
		).toBe(true)
		expect(
			queries.some((query) => query.text.includes('INSERT INTO auth_webauthn_credentials'))
		).toBe(true)
	})

	it('keeps postgres WebAuthn owners immutable and advances counters with compare-and-swap', async () => {
		const credential = { counter: 0, owner: 'user-1' }
		let inserted = false
		let insertedTransports: unknown
		const db: PgPoolLike = {
			async query(text, values = []) {
				if (text.includes('INSERT INTO auth_webauthn_credentials')) {
					if (inserted) return { rows: [] }
					inserted = true
					credential.owner = String(values[0])
					credential.counter = Number(values[3])
					insertedTransports = values[4]
					return { rows: [{ credential_id: values[1] }] }
				}
				if (text.includes('UPDATE auth_webauthn_credentials')) {
					const [newCounter, , owner, expectedCounter] = values
					if (credential.owner !== owner || credential.counter !== expectedCounter) {
						return { rows: [] }
					}
					credential.counter = Number(newCounter)
					return { rows: [{ credential_id: 'credential-1' }] }
				}
				if (text.includes('DELETE FROM auth_webauthn_credentials WHERE credential_id')) {
					const [, owner] = values
					if (credential.owner !== owner) return { rows: [] }
					return { rows: [{ credential_id: 'credential-1' }] }
				}
				if (text.includes('DELETE FROM auth_webauthn_challenges WHERE expires_at')) {
					return { rows: [{ id: 'expired-1' }, { id: 'expired-2' }] }
				}
				throw new Error(`Unexpected query: ${text}`)
			}
		}
		const adapters = createPgAuthAdapters({
			cookieName: 'auth',
			db,
			mfaSecretCodec,
			secureCookies: true
		})
		const registration = {
			counter: 0,
			credentialId: 'credential-1',
			publicKey: 'public-key',
			userId: 'user-1'
		}

		await expect(adapters.webauthn.createCredential(registration)).resolves.toBe(true)
		expect(insertedTransports).toBeNull()
		await expect(
			adapters.webauthn.createCredential({ ...registration, userId: 'attacker' })
		).resolves.toBe(false)
		expect(credential.owner).toBe('user-1')
		await expect(
			adapters.webauthn.advanceCredentialCounter({
				credentialId: 'credential-1',
				userId: 'user-1',
				expectedCounter: 0,
				newCounter: 1
			})
		).resolves.toBe(true)
		await expect(
			adapters.webauthn.advanceCredentialCounter({
				credentialId: 'credential-1',
				userId: 'user-1',
				expectedCounter: 0,
				newCounter: 2
			})
		).resolves.toBe(false)
		await expect(
			adapters.webauthn.advanceCredentialCounter({
				credentialId: 'credential-1',
				userId: 'attacker',
				expectedCounter: 1,
				newCounter: 2
			})
		).resolves.toBe(false)
		await expect(
			adapters.webauthn.deleteCredential({
				credentialId: 'credential-1',
				userId: 'attacker'
			})
		).resolves.toBe(false)
		await expect(
			adapters.webauthn.deleteCredential({
				credentialId: 'credential-1',
				userId: 'user-1'
			})
		).resolves.toBe(true)
		await expect(adapters.webauthn.deleteExpiredChallenges(new Date())).resolves.toBe(2)
		expect(credential).toEqual({ counter: 1, owner: 'user-1' })
	})

	it('uses the atomic postgres registration boundary for capped passkey creation', async () => {
		const calls: Array<{ text: string; values: readonly unknown[] }> = []
		let outcome = 'created'
		const db: PgPoolLike = {
			async query<T extends Record<string, unknown>>(text: string, values = []) {
				calls.push({ text, values })
				return { rows: [{ outcome } as T] }
			}
		}
		const adapter = createPgAuthAdapters({
			cookieName: 'auth',
			db,
			mfaSecretCodec,
			secureCookies: true
		}).webauthn

		await expect(
			adapter.createCredentialWithinLimit({
				counter: 4_294_967_295,
				credentialId: 'credential-1',
				maxCredentialsPerUser: 10,
				name: 'Security key',
				publicKey: 'public-key',
				transports: ['usb'],
				userId: 'user-1'
			})
		).resolves.toBe('created')
		expect(calls[0]?.text).toContain('auth_create_webauthn_credential_within_limit')
		expect(calls[0]?.values).toEqual([
			'user-1',
			'credential-1',
			'public-key',
			4_294_967_295,
			'["usb"]',
			'Security key',
			10
		])

		outcome = 'invalid'
		await expect(
			adapter.createCredentialWithinLimit({
				counter: 0,
				credentialId: 'credential-2',
				maxCredentialsPerUser: 10,
				publicKey: 'public-key',
				userId: 'user-1'
			})
		).rejects.toThrow('invalid WebAuthn credential creation outcome')
	})
})
