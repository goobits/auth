import { getRandomBytes } from "../utils/crypto.js";

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

function hexToBytes(hex: string): Uint8Array {
	if (!hex || hex.length % 2 !== 0) {
		throw new Error("Invalid hex string");
	}
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < bytes.length; i += 1) {
		bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	}
	return bytes;
}

function timingSafeEqual(a: string, b: string): boolean {
	if (!a || !b || a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i += 1) {
		diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return diff === 0;
}

async function sha256Hex(value: string): Promise<string> {
	const data = new TextEncoder().encode(value);
	if (!globalThis.crypto?.subtle) {
		throw new Error("WebCrypto is required");
	}
	const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
	return bytesToHex(new Uint8Array(digest));
}

export async function createAdminApiKey({
	prefix = "adm",
	bytes = 32,
}: { prefix?: string; bytes?: number } = {}): Promise<string> {
	const random = await getRandomBytes(bytes);
	return `${prefix}_${bytesToHex(random)}`;
}

export async function hashAdminApiKey(
	apiKey: string,
	{ salt = "" }: { salt?: string } = {},
): Promise<string> {
	if (!apiKey) throw new Error("apiKey is required");
	return sha256Hex(`${salt}${apiKey}`);
}

export async function verifyAdminApiKey(
	apiKey: string,
	hashed: string,
	{ salt = "" }: { salt?: string } = {},
): Promise<boolean> {
	if (!apiKey || !hashed) return false;
	const candidate = await hashAdminApiKey(apiKey, { salt });
	return timingSafeEqual(candidate, hashed);
}

export function parseApiKeyHeader(value: string | null): string | null {
	if (!value) return null;
	if (value.startsWith("ApiKey ")) return value.slice(7);
	if (value.startsWith("Bearer ")) return value.slice(7);
	return value;
}

export { timingSafeEqual, hexToBytes, bytesToHex };
