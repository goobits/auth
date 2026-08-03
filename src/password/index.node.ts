import { hash, verify } from '@node-rs/argon2'

import { assertPasswordInput, isPasswordWithinLimit } from './policy.ts'

export { MAX_PASSWORD_LENGTH, validatePasswordStrength } from './policy.ts'
export {
	createPasswordMigrationVerifier,
	type PasswordHashScheme,
	type PasswordHashVerifier,
	type PasswordVerificationResult
} from './migration.ts'

/**
 * Hash a password using Argon2id (native Node module)
 *
 * @param password - password value.
 */
export async function hashPassword(password: string): Promise<string> {
	assertPasswordInput(password)

	return await hash(password)
}

/**
 * Verify a password against its hash
 *
 * @param storedHash - stored hash value.
 * @param password - password value.
 */
export async function verifyPassword(storedHash: string, password: string): Promise<boolean> {
	if (!storedHash || !password || !isPasswordWithinLimit(password)) {
		return false
	}

	try {
		return await verify(storedHash, password)
	} catch {
		return false
	}
}
