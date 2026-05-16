import { argon2id, argon2Verify } from "hash-wasm";

// Cloudflare Workers-compatible Argon2id (WASM).
// Tuned for reasonable cost under edge CPU limits; apps should enforce rate limiting.
const DEFAULTS = {
	memorySize: 12_288, // KiB (12 MiB)
	iterations: 2,
	parallelism: 1,
	hashLength: 32,
	saltLength: 16,
} as const;

/**
 * Hash a password using the worker-safe Argon2id WASM implementation.
 *
 * @param password Plaintext password.
 * @returns Encoded password hash.
 */
export async function hashPassword(password: string): Promise<string> {
	if (!password || typeof password !== "string") {
		throw new Error("Password must be a non-empty string");
	}

	const salt = new Uint8Array(DEFAULTS.saltLength);
	globalThis.crypto.getRandomValues(salt);

	return await argon2id({
		password,
		salt,
		iterations: DEFAULTS.iterations,
		memorySize: DEFAULTS.memorySize,
		parallelism: DEFAULTS.parallelism,
		hashLength: DEFAULTS.hashLength,
		outputType: "encoded",
	});
}

/**
 * Verify a password against an encoded hash.
 *
 * @param storedHash Encoded password hash.
 * @param password Plaintext password.
 * @returns Whether the password matches.
 */
export async function verifyPassword(storedHash: string, password: string): Promise<boolean> {
	if (!storedHash || !password) return false;
	try {
		return await argon2Verify({
			password,
			hash: storedHash,
		});
	} catch (error) {
		const { getLogger } = await import("./logger.js");
		getLogger().error?.("Password verification error:", error);
		return false;
	}
}

/**
 * Validate the default password-strength policy.
 *
 * @param password Plaintext password.
 * @returns Validation result and user-facing errors.
 */
export function validatePasswordStrength(password: string): {
	valid: boolean;
	errors: string[];
} {
	// Same policy as Node build.
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

	return { valid: errors.length === 0, errors };
}
