import type { OAuthProfile, User } from '../../types/core.ts'
import type { UserAdapter } from './UserAdapter.ts'

/** Secret-bearing credential material returned only to authentication code. */
export type PasswordCredential = {
	user: User
	passwordHash: string | null
}

/**
 * Password persistence boundary. General user/profile adapters deliberately do
 * not expose password hashes or accept password fields.
 */
export interface PasswordCredentialAdapter {
	findPasswordCredential(identifier: string, field?: string): Promise<PasswordCredential | null>
	createUserWithPassword(
		profile: OAuthProfile,
		passwordHash: string,
		metadata?: Record<string, unknown>
	): Promise<User>
	updatePasswordHash(userId: string, passwordHash: string): Promise<User>
}

/**
 * Explicit public-profile and private-credential capabilities backed by one
 * user store. Consumers should pass only the capability a code path needs.
 */
export type UserAdapterBundle = Readonly<{
	user: UserAdapter
	passwordCredential: PasswordCredentialAdapter
}>
