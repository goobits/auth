import { describe, expect, it } from 'vitest'

import { D1UserAdapter } from '../../src/adapters/database/D1UserAdapter.ts'
import { D1VerificationTokenAdapter } from '../../src/adapters/verification-token/D1VerificationTokenAdapter.ts'
import { D1WebAuthnAdapter } from '../../src/adapters/webauthn/D1WebAuthnAdapter.ts'
import { createMockDb } from './_d1TestKit.ts'

describe('D1 WebAuthn and verification-token adapters', () => {
	it('keeps D1 WebAuthn owners immutable and counters compare-and-swap protected', async () => {
		type Credential = { userId: string; publicKey: string; counter: number }
		const credentials = new Map<string, Credential>()
		const db = {
			prepare(sql: string) {
				let values: unknown[] = []
				return {
					bind(...bound: unknown[]) {
						values = bound
						return this
					},
					async run() {
						if (sql.startsWith('INSERT INTO webauthn_credentials')) {
							const [userId, credentialId, publicKey, counter] = values as [
								string,
								string,
								string,
								number
							]
							if (credentials.has(credentialId)) return { meta: { changes: 0 } }
							credentials.set(credentialId, { userId, publicKey, counter })
							return { meta: { changes: 1 } }
						}
						if (sql.startsWith('UPDATE webauthn_credentials')) {
							const [newCounter, , credentialId, userId, expectedCounter] = values as [
								number,
								string,
								string,
								string,
								number
							]
							const current = credentials.get(credentialId)
							if (!current || current.userId !== userId || current.counter !== expectedCounter) {
								return { meta: { changes: 0 } }
							}
							credentials.set(credentialId, { ...current, counter: newCounter })
							return { meta: { changes: 1 } }
						}
						if (sql.startsWith('DELETE FROM webauthn_credentials')) {
							const [credentialId, userId] = values as [string, string]
							const current = credentials.get(credentialId)
							if (!current || current.userId !== userId) {
								return { meta: { changes: 0 } }
							}
							credentials.delete(credentialId)
							return { meta: { changes: 1 } }
						}
						if (sql.startsWith('DELETE FROM webauthn_challenges')) {
							return { meta: { changes: 2 } }
						}
						return { meta: { changes: 0 } }
					},
					async first() {
						return null
					},
					async all() {
						return { results: [] }
					}
				}
			}
		}
		const adapter = new D1WebAuthnAdapter(db as never)
		const first = {
			userId: 'owner-1',
			credentialId: 'credential-1',
			publicKey: 'key-1',
			counter: 0
		}
		await expect(adapter.createCredential(first)).resolves.toBe(true)
		await expect(
			adapter.createCredential({ ...first, userId: 'owner-2', publicKey: 'key-2' })
		).resolves.toBe(false)
		expect(credentials.get('credential-1')).toEqual({
			userId: 'owner-1',
			publicKey: 'key-1',
			counter: 0
		})
		await expect(
			adapter.advanceCredentialCounter({
				credentialId: 'credential-1',
				userId: 'owner-2',
				expectedCounter: 0,
				newCounter: 1
			})
		).resolves.toBe(false)
		await expect(
			adapter.advanceCredentialCounter({
				credentialId: 'credential-1',
				userId: 'owner-1',
				expectedCounter: 0,
				newCounter: 1
			})
		).resolves.toBe(true)
		await expect(
			adapter.advanceCredentialCounter({
				credentialId: 'credential-1',
				userId: 'owner-1',
				expectedCounter: 0,
				newCounter: 2
			})
		).resolves.toBe(false)
		await expect(
			adapter.deleteCredential({ credentialId: 'credential-1', userId: 'owner-2' })
		).resolves.toBe(false)
		await expect(
			adapter.deleteCredential({ credentialId: 'credential-1', userId: 'owner-1' })
		).resolves.toBe(true)
		await expect(adapter.deleteExpiredChallenges(new Date())).resolves.toBe(2)
	})

	it('creates and finds verification tokens', async () => {
		const db = createMockDb()
		const userAdapter = new D1UserAdapter(db)
		const user = await userAdapter.createUser({ email: 'c@d.com', name: 'C' })
		const tokens = new D1VerificationTokenAdapter(db)
		await tokens.create({
			userId: user.id,
			type: 'email_verification',
			token: 't',
			expiresAt: new Date(Date.now() + 1000)
		})
		const record = await tokens.findByToken({ token: 't', type: 'email_verification' })
		expect(record?.user?.email).toBe('c@d.com')
	})

	it('supports verification token tables with required created_at columns', async () => {
		const db = createMockDb()
		const userAdapter = new D1UserAdapter(db)
		const user = await userAdapter.createUser({ email: 'created@example.com', name: 'Created' })
		const tokens = new D1VerificationTokenAdapter(db, {
			columns: { createdAt: 'created_at' }
		})

		await tokens.create({
			userId: user.id,
			type: 'email_verification',
			token: 'created-token',
			expiresAt: new Date(Date.now() + 1000)
		})
		const record = await tokens.findByToken({
			token: 'created-token',
			type: 'email_verification'
		})

		expect(record?.token.createdAt).toBeInstanceOf(Date)
		expect(record?.token.createdAt.getTime()).toBeGreaterThan(0)
	})

	it('atomically replaces D1 verification tokens and round-trips metadata', async () => {
		const db = createMockDb()
		const userAdapter = new D1UserAdapter(db)
		const user = await userAdapter.createUser({ email: 'replace@example.com', name: 'Replace' })
		const tokens = new D1VerificationTokenAdapter(db, {
			columns: { createdAt: 'created_at', metadata: 'metadata' }
		})

		await tokens.replaceForUserAndType({
			userId: user.id,
			type: 'mfa_login',
			token: 'first-token',
			expiresAt: new Date(Date.now() + 1000),
			metadata: { rememberMe: false }
		})
		await tokens.replaceForUserAndType({
			userId: user.id,
			type: 'mfa_login',
			token: 'second-token',
			expiresAt: new Date(Date.now() + 2000),
			metadata: { rememberMe: true }
		})

		await expect(
			tokens.findByToken({ token: 'first-token', type: 'mfa_login' })
		).resolves.toBeNull()
		await expect(
			tokens.findByToken({ token: 'second-token', type: 'mfa_login' })
		).resolves.toMatchObject({ token: { metadata: { rememberMe: true } } })
	})

	it('keeps D1 verification token and user ids distinct', async () => {
		const db = createMockDb()
		const userAdapter = new D1UserAdapter(db)
		const user = await userAdapter.createUser({ email: 'token-owner@example.com', name: 'Owner' })
		const tokens = new D1VerificationTokenAdapter(db)
		await tokens.create({
			userId: user.id,
			type: 'email_verification',
			token: 'distinct-token',
			expiresAt: new Date(Date.now() + 1000)
		})

		const record = await tokens.findByToken({
			token: 'distinct-token',
			type: 'email_verification'
		})

		expect(record?.token.id).not.toBe(user.id)
		expect(record?.token.userId).toBe(user.id)
		expect(record?.user.id).toBe(user.id)
	})

	it('atomically consumes D1 verification tokens without id collisions', async () => {
		const db = createMockDb()
		const userAdapter = new D1UserAdapter(db)
		const user = await userAdapter.createUser({ email: 'consume-owner@example.com', name: 'Owner' })
		const tokens = new D1VerificationTokenAdapter(db)
		await tokens.create({
			userId: user.id,
			type: 'email_verification',
			token: 'consume-token',
			expiresAt: new Date(Date.now() + 1000)
		})

		const consumed = await tokens.consumeByToken({
			token: 'consume-token',
			type: 'email_verification'
		})
		const second = await tokens.consumeByToken({
			token: 'consume-token',
			type: 'email_verification'
		})

		expect(consumed?.token.id).not.toBe(user.id)
		expect(consumed?.token.userId).toBe(user.id)
		expect(consumed?.user.id).toBe(user.id)
		expect(second).toBeNull()
	})
})
