import { describe, expect, it, vi } from 'vitest'

import { createAuthEventAuditEmitter } from '../../src/security/audit.ts'

describe('Auth event audit bridge', () => {
	it('maps route events to the canonical redacted audit contract', async () => {
		const log = vi.fn(async () => undefined)
		const emit = createAuthEventAuditEmitter({ auditor: { log } })

		await emit({
			name: 'auth.csrf_failed',
			severity: 'warn',
			timestamp: '2026-07-15T12:00:00.000Z',
			route: '/auth/mfa/step-up',
			method: 'POST',
			status: 403,
			userId: '42',
			message: 'database password=never-store-this',
			details: { token: 'never-store-me', factor: 'totp' }
		})

		expect(log).toHaveBeenCalledWith({
			action: 'auth.csrf_failed',
			outcome: 'denied',
			timestamp: '2026-07-15T12:00:00.000Z',
			actorId: '42',
			method: 'POST',
			url: '/auth/mfa/step-up',
			status: 403,
			detail: { token: '[redacted]', factor: 'totp' }
		})
	})
})
