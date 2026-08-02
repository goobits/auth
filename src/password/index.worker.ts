import { randomBytes } from '@goobits/security/crypto'
import { argon2id, argon2Verify } from 'hash-wasm'

import { assertPasswordInput, isPasswordWithinLimit } from './policy.ts'

export { MAX_PASSWORD_LENGTH, validatePasswordStrength } from './policy.ts'
export {
	createPasswordMigrationVerifier,
	type PasswordHashScheme,
	type PasswordHashVerifier,
	type PasswordVerificationResult
} from './migration.ts'

// Cloudflare Workers-compatible Argon2id (WASM).
// Tuned for reasonable cost under edge CPU limits; apps should enforce rate limiting.
const DEFAULTS = {
	memorySize: 12_288, // KiB (12 MiB)
	iterations: 3,
	parallelism: 1,
	hashLength: 32,
	saltLength: 16
} as const

/** Hashes password for auth runtime. */
export async function hashPassword(password: string): Promise<string> {
	assertPasswordInput(password)

	const salt = randomBytes(DEFAULTS.saltLength)

	return await argon2id({
		password,
		salt,
		iterations: DEFAULTS.iterations,
		memorySize: DEFAULTS.memorySize,
		parallelism: DEFAULTS.parallelism,
		hashLength: DEFAULTS.hashLength,
		outputType: 'encoded'
	})
}

/** Verifies password for auth runtime. */
export async function verifyPassword(storedHash: string, password: string): Promise<boolean> {
	if (!storedHash || !password || !isPasswordWithinLimit(password)) return false
	try {
		return await argon2Verify({
			password,
			hash: storedHash
		})
	} catch {
		return false
	}
}
