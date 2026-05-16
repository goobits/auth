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

