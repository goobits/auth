import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import {
	PgMagicLinkAdapter,
	PgMfaAdapter,
	PgSessionAdapter,
	PgUserAdapter,
	PgVerificationTokenAdapter,
	PgWebAuthnAdapter,
	pgAuthSchemaSql
} from '../../src/adapters/pg/index.ts'
import { PgMagicLinkAdapter as DirectMagicLinkAdapter } from '../../src/adapters/pg/magicLink.ts'
import { PgMfaAdapter as DirectMfaAdapter } from '../../src/adapters/pg/mfa.ts'
import { pgAuthSchemaSql as directSchemaSql } from '../../src/adapters/pg/schema.ts'
import { PgSessionAdapter as DirectSessionAdapter } from '../../src/adapters/pg/session.ts'
import { PgUserAdapter as DirectUserAdapter } from '../../src/adapters/pg/user.ts'
import { PgVerificationTokenAdapter as DirectVerificationTokenAdapter } from '../../src/adapters/pg/verificationToken.ts'
import { PgWebAuthnAdapter as DirectWebAuthnAdapter } from '../../src/adapters/pg/webauthn.ts'
import { expectSingleDeclarationOwners } from './_moduleBoundaries.ts'

const owners = {
	'../_inputValues.ts': ['normalizeEmail', 'recordValue', 'stringValue'],
	'index.ts': ['createPgAuthAdapters'],
	'magicLink.ts': ['MagicLinkTokenRow', 'PgMagicLinkAdapter', 'toMagicLinkToken'],
	'mfa.ts': ['MfaFactorRow', 'MfaStatusRow', 'PgMfaAdapter'],
	'query.ts': ['PgPoolLike', 'requireRow'],
	'schema.ts': ['pgAuthSchemaSql'],
	'session.ts': ['SessionRow', 'PgSessionAdapter', 'toSession'],
	'user.ts': ['UserRow', 'PgUserAdapter', 'toUser'],
	'verificationToken.ts': [
		'VerificationTokenRow',
		'PgVerificationTokenAdapter',
		'toVerificationToken'
	],
	'webauthn.ts': [
		'WebAuthnChallengeRow',
		'WebAuthnCredentialRow',
		'PgWebAuthnAdapter',
		'toWebAuthnChallenge',
		'toWebAuthnCredential'
	]
} as const

describe('PostgreSQL auth adapter boundaries', () => {
	it('keeps published values identity-stable', () => {
		expect(PgMagicLinkAdapter).toBe(DirectMagicLinkAdapter)
		expect(PgMfaAdapter).toBe(DirectMfaAdapter)
		expect(PgSessionAdapter).toBe(DirectSessionAdapter)
		expect(PgUserAdapter).toBe(DirectUserAdapter)
		expect(PgVerificationTokenAdapter).toBe(DirectVerificationTokenAdapter)
		expect(PgWebAuthnAdapter).toBe(DirectWebAuthnAdapter)
		expect(pgAuthSchemaSql).toBe(directSchemaSql)
	})

	it('keeps every PostgreSQL adapter concept with one owner', async () => {
		await expectSingleDeclarationOwners(new URL('../../src/adapters/pg/', import.meta.url), owners)
	})

	it('keeps the published entrypoint free of adapter implementations and schema SQL', async () => {
		const source = await readFile(
			new URL('../../src/adapters/pg/index.ts', import.meta.url),
			'utf8'
		)
		expect(source).not.toMatch(/^export class /m)
		expect(source).not.toContain('CREATE TABLE')
		expect(source).not.toContain('#db')
	})

	it('publishes the PostgreSQL adapter for Node and Worker runtimes', async () => {
		const packageJson = JSON.parse(
			await readFile(new URL('../../package.json', import.meta.url), 'utf8')
		) as {
			exports: Record<string, Record<string, string>>
			publishConfig: { exports: Record<string, Record<string, string>> }
		}
		expect(packageJson.exports['./adapters/pg']).toMatchObject({
			workerd: './src/adapters/pg/index.ts',
			worker: './src/adapters/pg/index.ts',
			node: './src/adapters/pg/index.ts'
		})
		expect(packageJson.publishConfig.exports['./adapters/pg']).toMatchObject({
			workerd: './dist/worker/adapters/pg/index.js',
			worker: './dist/worker/adapters/pg/index.js',
			node: './dist/node/adapters/pg/index.js'
		})
	})
})
