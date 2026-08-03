import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import {
	MemoryMagicLinkAdapter,
	MemoryMfaAdapter,
	MemorySessionAdapter,
	MemoryUserAdapter,
	MemoryWebAuthnAdapter,
	MockSessionAdapter,
	MockTokenAdapter
} from '../../src/adapters/memory/index.ts'
import { MemoryMagicLinkAdapter as DirectMagicLinkAdapter } from '../../src/adapters/memory/magicLink.ts'
import { MemoryMfaAdapter as DirectMfaAdapter } from '../../src/adapters/memory/mfa.ts'
import { MemorySessionAdapter as DirectSessionAdapter } from '../../src/adapters/memory/session.ts'
import {
	MockSessionAdapter as DirectMockSessionAdapter,
	MockTokenAdapter as DirectMockTokenAdapter
} from '../../src/adapters/memory/testing.ts'
import { MemoryUserAdapter as DirectUserAdapter } from '../../src/adapters/memory/user.ts'
import { MemoryWebAuthnAdapter as DirectWebAuthnAdapter } from '../../src/adapters/memory/webauthn.ts'
import { expectSingleDeclarationOwners } from './_moduleBoundaries.ts'

const owners = {
	'index.ts': ['createMemoryAuthAdapters'],
	'magicLink.ts': ['StoredMagicLinkToken', 'MemoryMagicLinkAdapter'],
	'mfa.ts': ['MemoryMfaAdapter'],
	'session.ts': ['MemorySessionAdapter'],
	'testing.ts': ['MockSessionAdapter', 'MockTokenAdapter'],
	'user.ts': ['StoredUser', 'MemoryUserAdapter', 'sanitizeUser'],
	'webauthn.ts': ['MemoryWebAuthnAdapter']
} as const

describe('memory auth adapter boundaries', () => {
	it('keeps published values identity-stable', () => {
		expect(MemoryMagicLinkAdapter).toBe(DirectMagicLinkAdapter)
		expect(MemoryMfaAdapter).toBe(DirectMfaAdapter)
		expect(MemorySessionAdapter).toBe(DirectSessionAdapter)
		expect(MemoryUserAdapter).toBe(DirectUserAdapter)
		expect(MemoryWebAuthnAdapter).toBe(DirectWebAuthnAdapter)
		expect(MockSessionAdapter).toBe(DirectMockSessionAdapter)
		expect(MockTokenAdapter).toBe(DirectMockTokenAdapter)
	})

	it('keeps every memory adapter concept with one owner', async () => {
		await expectSingleDeclarationOwners(
			new URL('../../src/adapters/memory/', import.meta.url),
			owners
		)
	})

	it('keeps normalization shared and the published entrypoint implementation-free', async () => {
		const [indexSource, userSource, inputSource] = await Promise.all([
			readFile(new URL('../../src/adapters/memory/index.ts', import.meta.url), 'utf8'),
			readFile(new URL('../../src/adapters/memory/user.ts', import.meta.url), 'utf8'),
			readFile(new URL('../../src/adapters/_inputValues.ts', import.meta.url), 'utf8')
		])
		expect(indexSource).not.toMatch(/^export class /m)
		expect(indexSource).not.toContain('#users')
		expect(userSource).toContain("from '../_inputValues.ts'")
		expect(userSource).not.toMatch(/function (?:normalizeEmail|recordValue|stringValue)/)
		expect(inputSource.match(/export function /g)).toHaveLength(3)
	})
})
