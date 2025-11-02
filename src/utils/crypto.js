import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

/**
 * Encrypt tokens using AES-256-GCM
 * @param {Object} tokens - Tokens to encrypt
 * @param {string} encryptionKey - 32-byte hex encryption key
 * @returns {string} Encrypted tokens as JSON string
 */
export function encryptTokens(tokens, encryptionKey) {
	if (!encryptionKey) {
		throw new Error("Encryption key is required");
	}

	try {
		const iv = crypto.randomBytes(12);
		const cipher = crypto.createCipheriv(
			ALGORITHM,
			Buffer.from(encryptionKey, "hex"),
			iv,
		);

		const jsonString = JSON.stringify(tokens);
		const encrypted = Buffer.concat([
			cipher.update(jsonString, "utf8"),
			cipher.final(),
		]);
		const authTag = cipher.getAuthTag();

		const result = {
			iv: iv.toString("hex"),
			data: encrypted.toString("hex"),
			tag: authTag.toString("hex"),
		};

		return JSON.stringify(result);
	} catch (error) {
		console.error("Token encryption error:", error);
		throw error;
	}
}

/**
 * Decrypt tokens using AES-256-GCM
 * @param {string} encryptedData - Encrypted tokens as JSON string
 * @param {string} encryptionKey - 32-byte hex encryption key
 * @returns {Object|null} Decrypted tokens or null if decryption fails
 */
export function decryptTokens(encryptedData, encryptionKey) {
	if (!encryptedData) return null;
	if (!encryptionKey) {
		throw new Error("Encryption key is required");
	}

	try {
		const { iv, data, tag } = JSON.parse(encryptedData);

		const decipher = crypto.createDecipheriv(
			ALGORITHM,
			Buffer.from(encryptionKey, "hex"),
			Buffer.from(iv, "hex"),
		);

		decipher.setAuthTag(Buffer.from(tag, "hex"));

		const decrypted = Buffer.concat([
			decipher.update(Buffer.from(data, "hex")),
			decipher.final(),
		]);

		return JSON.parse(decrypted.toString("utf8"));
	} catch (error) {
		console.error("Token decryption error:", error);
		return null;
	}
}

/**
 * Generate a secure encryption key
 * @returns {string} 32-byte hex string
 */
export function generateEncryptionKey() {
	return crypto.randomBytes(32).toString("hex");
}
