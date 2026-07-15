import type { OAuthProfile, User } from '../../types/core.ts'

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
