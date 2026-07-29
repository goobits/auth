import type { UserAdapterBundle } from '../database/PasswordCredentialAdapter.ts'
import type { MfaSecretCodec } from '../mfa/MfaAdapter.ts'
import { PgMagicLinkAdapter } from './magicLink.ts'
import { PgMfaAdapter } from './mfa.ts'
import type { PgPoolLike } from './query.ts'
import { PgSessionAdapter } from './session.ts'
import { PgUserAdapter } from './user.ts'
import { PgVerificationTokenAdapter } from './verificationToken.ts'
import { PgWebAuthnAdapter } from './webauthn.ts'

export type { MfaSecretCodec } from '../mfa/MfaAdapter.ts'
export type { PgPoolLike } from './query.ts'
export { PgMagicLinkAdapter } from './magicLink.ts'
export { PgMfaAdapter } from './mfa.ts'
export { pgAuthSchemaSql } from './schema.ts'
export { PgSessionAdapter } from './session.ts'
export { PgUserAdapter } from './user.ts'
export { PgVerificationTokenAdapter } from './verificationToken.ts'
export { PgWebAuthnAdapter } from './webauthn.ts'

/** Creates pg auth adapters for auth storage. */
export function createPgAuthAdapters(input: {
	cookieDomain?: string
	cookieName: string
	db: PgPoolLike
	mfaSecretCodec: MfaSecretCodec
	secureCookies: boolean
}): UserAdapterBundle & {
	magicLink: PgMagicLinkAdapter
	mfa: PgMfaAdapter
	session: PgSessionAdapter
	verificationToken: PgVerificationTokenAdapter
	webauthn: PgWebAuthnAdapter
} {
	const user = new PgUserAdapter({ db: input.db })
	return {
		magicLink: new PgMagicLinkAdapter({ db: input.db }),
		mfa: new PgMfaAdapter({ db: input.db, secretCodec: input.mfaSecretCodec }),
		passwordCredential: user,
		session: new PgSessionAdapter(input),
		user,
		verificationToken: new PgVerificationTokenAdapter({ db: input.db }),
		webauthn: new PgWebAuthnAdapter({ db: input.db })
	}
}
