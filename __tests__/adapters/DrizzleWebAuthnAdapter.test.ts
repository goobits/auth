import { describe, expect, it, vi } from 'vitest'

import { DrizzleWebAuthnAdapter } from '../../src/adapters/webauthn/DrizzleWebAuthnAdapter.ts'
import type { DrizzleTable } from '../../src/adapters/drizzleTypes.ts'

function table(columns: string[]): DrizzleTable {
	return Object.fromEntries(columns.map((column) => [column, {}])) as DrizzleTable
}

const credentialsTable = table([
	'credentialId',
	'userId',
	'publicKey',
	'counter',
	'transports',
	'name',
	'createdAt',
	'updatedAt'
])
const challengesTable = table(['id', 'userId', 'challenge', 'type', 'expiresAt'])

function createAdapter(db: Record<string, unknown>): DrizzleWebAuthnAdapter {
	return new DrizzleWebAuthnAdapter(db as never, { credentialsTable, challengesTable })
}

describe('DrizzleWebAuthnAdapter', () => {
	it('uses insert-only credential ownership and reports conflicts', async () => {
		const returning = vi.fn().mockResolvedValueOnce([{}]).mockResolvedValueOnce([])
		const onConflictDoNothing = vi.fn(() => ({ returning }))
		const values = vi.fn(() => ({ onConflictDoNothing }))
		const adapter = createAdapter({ insert: () => ({ values }) })
		const credential = {
			userId: 'owner-1',
			credentialId: 'credential-1',
			publicKey: 'public-key',
			counter: 0
		}

		await expect(adapter.createCredential(credential)).resolves.toBe(true)
		await expect(adapter.createCredential({ ...credential, userId: 'owner-2' })).resolves.toBe(
			false
		)
		expect(onConflictDoNothing).toHaveBeenCalledTimes(2)
		expect(onConflictDoNothing).toHaveBeenCalledWith({ target: credentialsTable.credentialId })
	})

	it('requires one compare-and-swap row and rejects counter regressions', async () => {
		const returning = vi.fn().mockResolvedValueOnce([{}]).mockResolvedValueOnce([])
		const where = vi.fn(() => ({ returning }))
		const set = vi.fn(() => ({ where }))
		const adapter = createAdapter({ update: () => ({ set }) })
		const input = {
			credentialId: 'credential-1',
			userId: 'owner-1',
			expectedCounter: 1,
			newCounter: 2
		}

		await expect(adapter.advanceCredentialCounter(input)).resolves.toBe(true)
		await expect(adapter.advanceCredentialCounter(input)).resolves.toBe(false)
		await expect(adapter.advanceCredentialCounter({ ...input, newCounter: 1 })).rejects.toThrow(
			'advance monotonically'
		)
		expect(set).toHaveBeenCalledTimes(2)
		expect(where).toHaveBeenCalledTimes(2)
	})

	it('rejects invalid counters before issuing a query', async () => {
		const insert = vi.fn()
		const update = vi.fn()
		const adapter = createAdapter({ insert, update })

		await expect(
			adapter.createCredential({
				userId: 'owner-1',
				credentialId: 'credential-1',
				publicKey: 'public-key',
				counter: Number.NaN
			})
		).rejects.toThrow('non-negative safe integer')
		await expect(
			adapter.advanceCredentialCounter({
				credentialId: 'credential-1',
				userId: 'owner-1',
				expectedCounter: 0,
				newCounter: -1
			})
		).rejects.toThrow('non-negative safe integers')
		expect(insert).not.toHaveBeenCalled()
		expect(update).not.toHaveBeenCalled()
	})
})
