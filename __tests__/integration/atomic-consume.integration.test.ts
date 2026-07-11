/**
 * Atomic single-use semantics for `consume*` adapter methods.
 *
 * The in-tree Drizzle adapters override the base `find + delete` default
 * with a single `DELETE ... RETURNING` statement. These tests prove that
 * (a) a successful consume returns the row and removes it, (b) a second
 * consume of the same key returns null, and (c) concurrent consumes of
 * the same key produce exactly one winner.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { DrizzleMagicLinkAdapter } from '../../src/adapters/magic-link/DrizzleMagicLinkAdapter.ts'
import type { DrizzleDbLike } from '../../src/adapters/drizzleTypes.ts'
import {
	createIntegrationDrizzleFixture,
	drizzleMagicLinkTokensTable
} from '../drizzleTestKit.ts'

describe('Atomic consume — DrizzleMagicLinkAdapter', () => {
	let db: DrizzleDbLike
	let dispose: () => Promise<void>
	let adapter: DrizzleMagicLinkAdapter

	beforeAll(async() => {
		const fixture = await createIntegrationDrizzleFixture()
		db = fixture.db
		dispose = fixture.dispose
		adapter = new DrizzleMagicLinkAdapter(db, {
			tokensTable: drizzleMagicLinkTokensTable
		})
	})

	afterAll(async() => {
		await dispose()
	})

	it('returns the row and deletes it in one statement', async() => {
		await adapter.createToken({
			userId: null,
			email: 'alice@example.com',
			tokenHash: 'hash-alpha',
			expiresAt: new Date(Date.now() + 60_000)
		})

		const consumed = await adapter.consumeByTokenHash('hash-alpha')
		expect(consumed).not.toBeNull()
		expect(consumed?.email).toBe('alice@example.com')

		// Row is gone.
		const second = await adapter.consumeByTokenHash('hash-alpha')
		expect(second).toBeNull()

		// And findByTokenHash also returns null afterward.
		const lookup = await adapter.findByTokenHash('hash-alpha')
		expect(lookup).toBeNull()
	})

	it('returns null when no row matches', async() => {
		const consumed = await adapter.consumeByTokenHash('does-not-exist')
		expect(consumed).toBeNull()
	})

	it('exactly one of N concurrent consumes wins for the same key', async() => {
		await adapter.createToken({
			userId: null,
			email: 'bob@example.com',
			tokenHash: 'hash-concurrent',
			expiresAt: new Date(Date.now() + 60_000)
		})

		const results = await Promise.all([
			adapter.consumeByTokenHash('hash-concurrent'),
			adapter.consumeByTokenHash('hash-concurrent'),
			adapter.consumeByTokenHash('hash-concurrent'),
			adapter.consumeByTokenHash('hash-concurrent')
		])

		const winners = results.filter(r => r !== null)
		expect(winners.length).toBe(1)
		expect(winners[0]?.email).toBe('bob@example.com')
	})

	it('consumeByEmailAndOtpHash atomically removes the matching row', async() => {
		await adapter.createToken({
			userId: null,
			email: 'carol@example.com',
			tokenHash: 'hash-carol',
			otpHash: 'otp-carol',
			expiresAt: new Date(Date.now() + 60_000)
		})

		const consumed = await adapter.consumeByEmailAndOtpHash({
			email: 'carol@example.com',
			otpHash: 'otp-carol'
		})
		expect(consumed?.email).toBe('carol@example.com')

		const second = await adapter.consumeByEmailAndOtpHash({
			email: 'carol@example.com',
			otpHash: 'otp-carol'
		})
		expect(second).toBeNull()
	})
})
