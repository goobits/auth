import { isPasswordWithinLimit } from './policy.ts'

export type PasswordHashVerifier = (
	storedHash: string,
	password: string
) => boolean | Promise<boolean>

/** One recognized stored-password scheme in a controlled migration chain. */
export type PasswordHashScheme = {
	matches: (storedHash: string) => boolean
	verify: PasswordHashVerifier
}

/** Result consumed by CredentialsProvider for transparent hash upgrades. */
export type PasswordMigrationVerificationResult = {
	valid: boolean
	needsRehash?: boolean
}

/**
 * Composes one current password scheme with read-only legacy schemes. New
 * hashes remain owned by the caller's current hasher; successful legacy
 * verification asks CredentialsProvider to replace the stored hash.
 */
export function createPasswordMigrationVerifier(options: {
	current: PasswordHashScheme
	legacy?: readonly PasswordHashScheme[]
}): (storedHash: string, password: string) => Promise<PasswordMigrationVerificationResult> {
	const schemes = [options.current, ...(options.legacy ?? [])]

	return async (storedHash, password) => {
		if (!storedHash || !password || !isPasswordWithinLimit(password)) {
			return { valid: false, needsRehash: false }
		}

		let schemeIndex = -1
		try {
			schemeIndex = schemes.findIndex((scheme) => scheme.matches(storedHash))
		} catch {
			return { valid: false, needsRehash: false }
		}
		if (schemeIndex < 0) return { valid: false, needsRehash: false }

		try {
			const valid = await schemes[schemeIndex]!.verify(storedHash, password)
			return { valid, needsRehash: valid && schemeIndex > 0 }
		} catch {
			return { valid: false, needsRehash: false }
		}
	}
}
