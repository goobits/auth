import { describe, expect, it } from 'vitest'

import * as root from '../src/index.ts'
import * as adapters from '../src/adapters/index.ts'
import * as database from '../src/adapters/database/index.ts'
import * as drizzle from '../src/adapters/drizzle/index.ts'
import * as magicLink from '../src/adapters/magic-link/index.ts'
import * as memory from '../src/adapters/memory/index.ts'
import * as mfaAdapter from '../src/adapters/mfa/index.ts'
import * as oauthToken from '../src/adapters/oauth-token/index.ts'
import * as pg from '../src/adapters/pg/index.ts'
import * as session from '../src/adapters/session/index.ts'
import * as verificationToken from '../src/adapters/verification-token/index.ts'
import * as webauthnAdapter from '../src/adapters/webauthn/index.ts'
import * as client from '../src/client/index.ts'
import * as errors from '../src/errors/index.ts'
import * as handlers from '../src/handlers/index.ts'
import * as loginContext from '../src/login-context/index.ts'
import * as mfa from '../src/mfa/index.ts'
import * as node from '../src/node/index.ts'
import * as password from '../src/password/index.ts'
import * as providers from '../src/providers/index.ts'
import * as qr from '../src/qr/index.ts'
import * as security from '../src/security/index.ts'
import * as testing from '../src/testing/index.ts'
import * as types from '../src/types/index.ts'
import * as verification from '../src/verification/index.ts'

const publicApis = {
	root,
	adapters,
	database,
	drizzle,
	magicLink,
	memory,
	mfaAdapter,
	oauthToken,
	pg,
	session,
	verificationToken,
	webauthnAdapter,
	client,
	errors,
	handlers,
	loginContext,
	mfa,
	node,
	password,
	providers,
	qr,
	security,
	testing,
	types,
	verification
}

describe('public API', () => {
	it('pins every JavaScript export by supported subpath', () => {
		expect(
			Object.fromEntries(
				Object.entries(publicApis).map(([subpath, api]) => [subpath, Object.keys(api).sort()])
			)
		).toMatchSnapshot()
	})
})
