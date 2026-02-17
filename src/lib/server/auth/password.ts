const encoder = new TextEncoder();

function toBase64(bytes: Uint8Array): string {
	// Prefer Buffer when available (nodejs_compat / Node). Fallback to btoa for safety.
	if (typeof Buffer !== 'undefined') {
		return Buffer.from(bytes).toString('base64');
	}
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
	if (typeof Buffer !== 'undefined') {
		return new Uint8Array(Buffer.from(value, 'base64'));
	}
	const binary = atob(value);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
	return diff === 0;
}

const PBKDF2_VERSION = 'pbkdf2';
const PBKDF2_HASH = 'sha256';
const PBKDF2_ITERATIONS = 210_000;
const PBKDF2_SALT_BYTES = 16;
const PBKDF2_KEY_BITS = 256;

export async function hashPasswordPbkdf2(password: string): Promise<string> {
	const salt = new Uint8Array(PBKDF2_SALT_BYTES);
	crypto.getRandomValues(salt);
	const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
		'deriveBits'
	]);
	const bits = await crypto.subtle.deriveBits(
		{ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS },
		keyMaterial,
		PBKDF2_KEY_BITS
	);
	const derived = new Uint8Array(bits);
	return `${PBKDF2_VERSION}$${PBKDF2_HASH}$${String(PBKDF2_ITERATIONS)}$${toBase64(salt)}$${toBase64(derived)}`;
}

export async function verifyPasswordPbkdf2(storedHash: string, password: string): Promise<boolean> {
	const [version, hash, iterationsRaw, saltB64, derivedB64] = storedHash.split('$');
	if (version !== PBKDF2_VERSION) return false;
	if (hash !== PBKDF2_HASH) return false;
	const iterations = Number(iterationsRaw);
	if (!Number.isFinite(iterations) || iterations < 10_000) return false;
	if (!saltB64 || !derivedB64) return false;

	// Ensure `ArrayBuffer` backing (WebCrypto in TS doesn't accept `ArrayBufferLike`).
	const salt = new Uint8Array(fromBase64(saltB64));
	const expected = new Uint8Array(fromBase64(derivedB64));
	const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
		'deriveBits'
	]);
	const bits = await crypto.subtle.deriveBits(
		{ name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
		keyMaterial,
		PBKDF2_KEY_BITS
	);
	const actual = new Uint8Array(bits);
	return constantTimeEqual(actual, expected);
}
