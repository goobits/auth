import { describe, expect, it } from 'vitest'
import type { AuditEvent, AuditLogger } from '@goobits/security/audit'

import { auditAuthEvent } from '../../src/security/audit.ts'

describe('auth audit events', () => {
	it('records auth-specific events through the shared security auditor', () => {
		const events: AuditEvent[] = []
		const auditor: AuditLogger = {
			async log(event) {
				events.push({
					timestamp: 'test',
					...event
				})
			}
		}

		auditAuthEvent(
			'magic_link.invalid',
			{
				userId: 'user-1',
				token: 'secret-token',
				email: 'miko@example.test'
			},
			{ auditor }
		)

		expect(events).toEqual([
			{
				action: 'magic_link.invalid',
				outcome: 'failure',
				timestamp: 'test',
				actorId: 'user-1',
				detail: {
					userId: 'user-1',
					token: '[redacted]',
					email: 'miko@example.test'
				}
			}
		])
	})
})
