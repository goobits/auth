const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(length: number = 10): string {
	const bytes = new Uint8Array(length);
	crypto.getRandomValues(bytes);
	let out = "";
	for (const b of bytes) {
		out += ALPHABET[b % ALPHABET.length];
	}
	return out;
}

export function generateBackupCodes({
	count = 10,
	length = 10,
}: { count?: number; length?: number } = {}): string[] {
	const codes: string[] = [];
	for (let i = 0; i < count; i += 1) {
		codes.push(randomCode(length));
	}
	return codes;
}

async function sha256Hex(value: string): Promise<string> {
	if (globalThis.crypto?.subtle) {
		const data = new TextEncoder().encode(value);
		const digest = await crypto.subtle.digest("SHA-256", data);
		return Array.from(new Uint8Array(digest))
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");
	}
	const { createHash } = await import("node:crypto");
	return createHash("sha256").update(value).digest("hex");
}

export async function hashBackupCodes(codes: string[]): Promise<string[]> {
	return Promise.all(codes.map((c) => sha256Hex(c)));
}

export async function verifyBackupCode({
	code,
	hashedCodes,
}: {
	code?: string;
	hashedCodes?: string[];
}): Promise<{ valid: boolean; hash?: string; index?: number }> {
	if (!code || !hashedCodes?.length) return { valid: false };
	const hash = await sha256Hex(code);
	const idx = hashedCodes.indexOf(hash);
	if (idx === -1) return { valid: false };
	return { valid: true, hash, index: idx };
}
