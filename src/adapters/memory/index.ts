import type { UserAdapterBundle } from '../database/PasswordCredentialAdapter.ts'
import { MemoryMagicLinkAdapter } from './magicLink.ts'
import { MemoryMfaAdapter } from './mfa.ts'
import { MemorySessionAdapter } from './session.ts'
import { MemoryUserAdapter } from './user.ts'
import { MemoryWebAuthnAdapter } from './webauthn.ts'

export { MemoryMagicLinkAdapter } from './magicLink.ts'
export { MemoryMfaAdapter } from './mfa.ts'
export { MemorySessionAdapter } from './session.ts'
export { MockSessionAdapter, MockTokenAdapter } from './testing.ts'
export { MemoryUserAdapter } from './user.ts'
export { MemoryWebAuthnAdapter } from './webauthn.ts'

/** Creates the default in-memory auth adapter bundle. */
export function createMemoryAuthAdapters(input: {
	cookieDomain?: string
	cookieName: string
	secureCookies: boolean
	sessionLifetimeMs?: number
}): UserAdapterBundle & {
	magicLink: MemoryMagicLinkAdapter
	session: MemorySessionAdapter
	mfa: MemoryMfaAdapter
	webauthn: MemoryWebAuthnAdapter
} {
	const user = new MemoryUserAdapter()
	return {
		magicLink: new MemoryMagicLinkAdapter(),
		passwordCredential: user,
		session: new MemorySessionAdapter({
			...(input.cookieDomain ? { cookieDomain: input.cookieDomain } : {}),
			...(input.sessionLifetimeMs !== undefined
				? { sessionLifetimeMs: input.sessionLifetimeMs }
				: {}),
			cookieName: input.cookieName,
			secureCookies: input.secureCookies,
			users: user
		}),
		mfa: new MemoryMfaAdapter(),
		user,
		webauthn: new MemoryWebAuthnAdapter()
	}
}
