import { hash, verify } from "@node-rs/argon2";

/**
 * Hash a password using Argon2id (native Node module)
 */
export async function hashPassword(password: string): Promise<string> {
	if (!password || typeof password !== "string") {
		throw new Error("Password must be a non-empty string");
	}

	return await hash(password);
}

/**
 * Verify a password against its hash
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
		const { getLogger } = await import("./logger.js");
		getLogger().error?.("Password verification error:", error);
		return false;
	}
}

/**
 * Validate password strength (basic policy; apps may enforce stricter rules).
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

