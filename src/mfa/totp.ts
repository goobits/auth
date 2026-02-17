const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function toBase32(bytes: Uint8Array): string {
	let bits = 0;
	let value = 0;
	let output = "";
	for (const byte of bytes) {
		value = (value << 8) | byte;
		bits += 8;
		while (bits >= 5) {
			output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
			bits -= 5;
		}
	}
	if (bits > 0) {
		output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
	}
	return output;
}

function fromBase32(input: string): Uint8Array {
	const clean = input.replace(/=+$/g, "").toUpperCase();
	let bits = 0;
	let value = 0;
	const output = [];
	for (const ch of clean) {
		const idx = BASE32_ALPHABET.indexOf(ch);
		if (idx === -1) continue;
		value = (value << 5) | idx;
		bits += 5;
		if (bits >= 8) {
			output.push((value >>> (bits - 8)) & 255);
			bits -= 8;
		}
	}
	return new Uint8Array(output);
}

async function hmacSha1(
	keyBytes: Uint8Array,
	messageBytes: Uint8Array,
): Promise<Uint8Array> {
	if (!globalThis.crypto?.subtle) {
		throw new Error("WebCrypto is required");
	}
	const key = await crypto.subtle.importKey(
		"raw",
		keyBytes as unknown as BufferSource,
		{ name: "HMAC", hash: "SHA-1" },
		false,
		["sign"],
	);
	const sig = await crypto.subtle.sign(
		"HMAC",
		key,
		messageBytes as unknown as BufferSource,
	);
	return new Uint8Array(sig);
}

function intToBytes(num: number): Uint8Array {
	const bytes = new Uint8Array(8);
	for (let i = 7; i >= 0; i -= 1) {
		bytes[i] = num & 0xff;
		num = Math.floor(num / 256);
	}
	return bytes;
}

export function generateSecret({ length = 20 }: { length?: number } = {}): string {
	const bytes = new Uint8Array(length);
	crypto.getRandomValues(bytes);
	return toBase32(bytes);
}

export function createOtpAuthURL({
	secret = "",
	label = "",
	issuer = "",
	digits = 6,
	period = 30,
}: {
	secret?: string;
	label?: string;
	issuer?: string;
	digits?: number;
	period?: number;
} = {}): string {
	const params = new URLSearchParams({
		secret,
		issuer,
		digits: String(digits),
		period: String(period),
	});
	return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
}

export async function generateTOTP({
	secret = "",
	time = Date.now(),
	digits = 6,
	period = 30,
}: {
	secret?: string;
	time?: number;
	digits?: number;
	period?: number;
} = {}): Promise<string> {
	if (!secret) {
		throw new Error("TOTP secret is required");
	}
	const counter = Math.floor(time / 1000 / period);
	const counterBytes = intToBytes(counter);
	const keyBytes = fromBase32(secret);
	const hash = await hmacSha1(keyBytes, counterBytes);
	const last = hash[hash.length - 1] ?? 0;
	const offset = last & 0xf;
	const code =
		(((hash[offset] ?? 0) & 0x7f) << 24) |
		(((hash[offset + 1] ?? 0) & 0xff) << 16) |
		(((hash[offset + 2] ?? 0) & 0xff) << 8) |
		((hash[offset + 3] ?? 0) & 0xff);
	const otp = (code % 10 ** digits).toString().padStart(digits, "0");
	return otp;
}

export async function verifyTOTP({
	secret = "",
	token = "",
	digits = 6,
	period = 30,
	window = 1,
	time = Date.now(),
}: {
	secret?: string;
	token?: string;
	digits?: number;
	period?: number;
	window?: number;
	time?: number;
} = {}): Promise<boolean> {
	if (!secret || !token) return false;
	for (let errorWindow = -window; errorWindow <= window; errorWindow += 1) {
		const t = time + errorWindow * period * 1000;
		const candidate = await generateTOTP({ secret, time: t, digits, period });
		if (candidate === token) return true;
	}
	return false;
}

export { toBase32, fromBase32 };
