import { hash, verify } from "@node-rs/argon2";

/**
 * Hash a password using Argon2id
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
export async function hashPassword(password: string): Promise<string> {
	if (!password || typeof password !== "string") {
		throw new Error("Password must be a non-empty string");
	}

	return await hash(password);
}

/**
 * Verify a password against its hash
 * @param {string} storedHash - Hashed password from database
 * @param {string} password - Plain text password to verify
 * @returns {Promise<boolean>} True if password matches
 */
export async function verifyPassword(
	storedHash: string,
	password: string,
): Promise<boolean> {
	if (!storedHash || !password) {
		return false;
	}

	try {
		return await verify(storedHash, password);
	} catch (error) {
		const { getLogger } = await import("./logger.ts");
		getLogger().error?.("Password verification error:", error);
		return false;
	}
}

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validatePasswordStrength(password: string): {
	valid: boolean;
	errors: string[];
} {
	const errors: string[] = [];

	if (!password) {
		errors.push("Password is required");
		return { valid: false, errors };
	}

	if (password.length < 8) {
		errors.push("Password must be at least 8 characters long");
	}

	if (!/[a-z]/.test(password)) {
		errors.push("Password must contain at least one lowercase letter");
	}

	if (!/[A-Z]/.test(password)) {
		errors.push("Password must contain at least one uppercase letter");
	}

	if (!/[0-9]/.test(password)) {
		errors.push("Password must contain at least one number");
	}

	return {
		valid: errors.length === 0,
		errors,
	};
}
