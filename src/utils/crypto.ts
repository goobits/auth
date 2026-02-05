const ALGORITHM = "AES-GCM";
const TAG_LENGTH_BYTES = 16;
const SHA_256 = "SHA-256";

type WebCrypto = {
	subtle: SubtleCrypto;
	getRandomValues: (array: Uint8Array) => Uint8Array;
	randomUUID?: () => string;
};

async function getWebCrypto(): Promise<WebCrypto> {
	if (globalThis.crypto?.subtle) {
		return globalThis.crypto as WebCrypto;
	}
	const { webcrypto } = await import("node:crypto");
	return webcrypto as unknown as WebCrypto;
}

async function getRandomBytes(length: number): Promise<Uint8Array> {
	const bytes = new Uint8Array(length);
	if (globalThis.crypto?.getRandomValues) {
		globalThis.crypto.getRandomValues(bytes);
		return bytes;
	}
	const { randomFillSync } = await import("node:crypto");
	return randomFillSync(bytes);
}

function hexToBytes(hex: string): Uint8Array {
	if (typeof hex !== "string" || hex.length % 2 !== 0) {
		throw new Error("Encryption key must be a hex string");
	}
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < bytes.length; i += 1) {
		bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	}
	return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

function validateEncryptionKey(encryptionKey: string): Uint8Array {
	const keyBytes = hexToBytes(encryptionKey);
	if (keyBytes.length !== 32) {
		throw new Error("Encryption key must be 32 bytes (64 hex chars)");
	}
	return keyBytes;
}

export async function encryptTokens<T extends Record<string, unknown>>(
	tokens: T,
	encryptionKey: string,
): Promise<string> {
	if (!encryptionKey) {
		throw new Error("Encryption key is required");
	}

	try {
		const cryptoImpl = await getWebCrypto();
		const keyBytes = validateEncryptionKey(encryptionKey);
		const iv = await getRandomBytes(12);
		const plaintext = new TextEncoder().encode(JSON.stringify(tokens));
		const key = await cryptoImpl.subtle.importKey(
			"raw",
			keyBytes as unknown as BufferSource,
			{ name: ALGORITHM },
			false,
			["encrypt"],
		);
		const cipherBuffer = await cryptoImpl.subtle.encrypt(
			{ name: ALGORITHM, iv: iv as unknown as BufferSource },
			key,
			plaintext as unknown as BufferSource,
		);
		const cipherBytes = new Uint8Array(cipherBuffer);
		const data = cipherBytes.slice(0, cipherBytes.length - TAG_LENGTH_BYTES);
		const tag = cipherBytes.slice(cipherBytes.length - TAG_LENGTH_BYTES);

		return JSON.stringify({
			iv: bytesToHex(iv),
			data: bytesToHex(data),
			tag: bytesToHex(tag),
		});
	} catch (error) {
		const { getLogger } = await import("./logger.ts");
		getLogger().error?.("Token encryption error:", error);
		throw error;
	}
}

export async function decryptTokens<T = Record<string, unknown>>(
	encryptedData: string | null,
	encryptionKey: string,
): Promise<T | null> {
	if (!encryptedData) return null;
	if (!encryptionKey) {
		throw new Error("Encryption key is required");
	}

	try {
		const cryptoImpl = await getWebCrypto();
		const keyBytes = validateEncryptionKey(encryptionKey);
		const { iv, data, tag } = JSON.parse(encryptedData);
		const ivBytes = hexToBytes(iv);
		const dataBytes = hexToBytes(data);
		const tagBytes = hexToBytes(tag);
		const cipherBytes = new Uint8Array(dataBytes.length + tagBytes.length);
		cipherBytes.set(dataBytes, 0);
		cipherBytes.set(tagBytes, dataBytes.length);

		const key = await cryptoImpl.subtle.importKey(
			"raw",
			keyBytes as unknown as BufferSource,
			{ name: ALGORITHM },
			false,
			["decrypt"],
		);
		const plainBuffer = await cryptoImpl.subtle.decrypt(
			{ name: ALGORITHM, iv: ivBytes as unknown as BufferSource },
			key,
			cipherBytes as unknown as BufferSource,
		);
		return JSON.parse(new TextDecoder().decode(plainBuffer));
	} catch (error) {
		const { getLogger } = await import("./logger.ts");
		getLogger().error?.("Token decryption error:", error);
		return null;
	}
}

export async function generateEncryptionKey(): Promise<string> {
	const bytes = await getRandomBytes(32);
	return bytesToHex(bytes);
}

export async function generateRandomUUID(): Promise<string> {
	if (globalThis.crypto?.randomUUID) {
		return globalThis.crypto.randomUUID();
	}
	const bytes = await getRandomBytes(16);
	bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
	bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
	const hex = bytesToHex(bytes);
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export { getRandomBytes };

export async function sha256Hex(value: string | Uint8Array): Promise<string> {
	const cryptoImpl = await getWebCrypto();
	const data =
		typeof value === "string" ? new TextEncoder().encode(value) : value;
	const digest = await cryptoImpl.subtle.digest(
		SHA_256,
		data as unknown as BufferSource,
	);
	return bytesToHex(new Uint8Array(digest));
}
