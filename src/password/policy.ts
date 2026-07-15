/** Absolute password input ceiling used to bound hashing and verification cost. */
export const MAX_PASSWORD_LENGTH = 1024

/** Returns whether a runtime password value is a string within the absolute limit. */
export function isPasswordWithinLimit(password: unknown): password is string {
	return typeof password === 'string' && password.length <= MAX_PASSWORD_LENGTH
}

/** Rejects empty, non-string, and excessively long password inputs before hashing. */
export function assertPasswordInput(password: unknown): asserts password is string {
	if (typeof password !== 'string' || !password) {
		throw new Error('Password must be a non-empty string')
	}
	if (!isPasswordWithinLimit(password)) {
		throw new Error(`Password must be at most ${MAX_PASSWORD_LENGTH} characters long`)
	}
}

/** Validates the package's baseline password policy. */
export function validatePasswordStrength(password: string): {
	valid: boolean
	errors: string[]
} {
	const errors: string[] = []

	if (typeof password !== 'string' || !password) {
		errors.push('Password is required')
		return { valid: false, errors }
	}

	if (!isPasswordWithinLimit(password)) {
		errors.push(`Password must be at most ${MAX_PASSWORD_LENGTH} characters long`)
		return { valid: false, errors }
	}

	if (password.length < 8) {
		errors.push('Password must be at least 8 characters long')
	}

	if (!/[a-z]/.test(password)) {
		errors.push('Password must contain at least one lowercase letter')
	}

	if (!/[A-Z]/.test(password)) {
		errors.push('Password must contain at least one uppercase letter')
	}

	if (!/[0-9]/.test(password)) {
		errors.push('Password must contain at least one number')
	}

	return { valid: errors.length === 0, errors }
}
