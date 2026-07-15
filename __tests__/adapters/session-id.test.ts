import { describe, expect, it } from 'vitest'

import { generateSessionId } from '../../src/adapters/session/sessionId.ts'

describe('session identifiers', () => {
	it('uses the requested entropy and unpadded base64url encoding', () => {
		expect(generateSessionId()).toMatch(/^[A-Za-z0-9_-]{27}$/)
		expect(generateSessionId(24)).toMatch(/^[A-Za-z0-9_-]{32}$/)
	})

	it('generates unique values', () => {
		expect(generateSessionId()).not.toBe(generateSessionId())
	})
})
