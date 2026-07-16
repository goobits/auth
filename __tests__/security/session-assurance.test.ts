import { describe, expect, it } from 'vitest'

import {
	hasRecentMfaVerification,
	hasRecentPrimaryAuthentication
} from '../../src/security/authorize.ts'
import type { Session } from '../../src/types/core.ts'

function session(overrides: Partial<Session> = {}): Session {
	return {
		id: 's1',
		userId: 'u1',
		expiresAt: new Date('2026-07-16T00:00:00.000Z'),
		...overrides
	}
}

describe('session assurance', () => {
	const now = new Date('2026-07-15T12:00:00.000Z')

	it('checks primary and MFA freshness independently', () => {
		const value = session({
			createdAt: new Date('2026-07-15T11:50:00.000Z'),
			mfaVerifiedAt: new Date('2026-07-15T11:59:00.000Z')
		})
		expect(hasRecentPrimaryAuthentication(value, { maxAgeMs: 5 * 60_000, now })).toBe(false)
		expect(hasRecentMfaVerification(value, { maxAgeMs: 5 * 60_000, now })).toBe(true)
	})

	it('fails closed for missing, invalid, stale, or implausibly future timestamps', () => {
		expect(hasRecentPrimaryAuthentication(session(), { maxAgeMs: 60_000, now })).toBe(false)
		expect(
			hasRecentMfaVerification(session({ mfaVerifiedAt: new Date('2026-07-15T12:02:00.000Z') }), {
				maxAgeMs: 60_000,
				now
			})
		).toBe(false)
		expect(hasRecentMfaVerification(session({ mfaVerifiedAt: now }), { maxAgeMs: -1, now })).toBe(
			false
		)
	})
})
