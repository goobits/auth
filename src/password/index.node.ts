import { hash, verify } from '@node-rs/argon2'

import { assertPasswordInput, isPasswordWithinLimit } from './policy.ts'

export { MAX_PASSWORD_LENGTH, validatePasswordStrength } from './policy.ts'

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
	} catch (error) {
		const { getLogger } = await import('../utils/logger.ts')
		getLogger().error?.(
			'Password verification error:',
			error instanceof Error ? error.message : String(error)
		)
		return false
	}
}
