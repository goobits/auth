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

type PgAuthAdapterInput = {
	cookieDomain?: string
	cookieName: string
	db: PgPoolLike
	secureCookies: boolean
	sessionLifetimeMs?: number
}

type PgAuthAdapters = UserAdapterBundle & {
	magicLink: PgMagicLinkAdapter
	session: PgSessionAdapter
	verificationToken: PgVerificationTokenAdapter
	webauthn: PgWebAuthnAdapter
}

type PgAuthAdaptersFor<T extends MfaSecretCodec | undefined> = PgAuthAdapters &
	(T extends MfaSecretCodec ? { mfa: PgMfaAdapter } : { mfa?: undefined })

/** Creates pg auth adapters for auth storage. */
export function createPgAuthAdapters<T extends MfaSecretCodec | undefined = undefined>(
	input: PgAuthAdapterInput & { mfaSecretCodec?: T }
): PgAuthAdaptersFor<T> {
	const user = new PgUserAdapter({ db: input.db })
	const adapters: PgAuthAdapters = {
		magicLink: new PgMagicLinkAdapter({ db: input.db }),
		passwordCredential: user,
		session: new PgSessionAdapter(input),
		user,
		verificationToken: new PgVerificationTokenAdapter({ db: input.db }),
		webauthn: new PgWebAuthnAdapter({ db: input.db })
	}
	const result = input.mfaSecretCodec
		? {
				...adapters,
				mfa: new PgMfaAdapter({ db: input.db, secretCodec: input.mfaSecretCodec })
			}
		: adapters
	return result as unknown as PgAuthAdaptersFor<T>
}
