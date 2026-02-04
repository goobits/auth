import { getRandomBytes } from "../utils/crypto.js";

export const CSRF_COOKIE_NAME = "csrf-token";
export const CSRF_HEADER_NAME = "x-csrf-token";

export class MemoryCsrfStore {
	constructor() {
		this._data = new Map();
	}

	async get(key) {
		const record = this._data.get(key);
		if (!record) return null;
		if (record.expiresAt && Date.now() > record.expiresAt) {
			this._data.delete(key);
			return null;
		}
		return record;
	}

	async set(key, value, ttlMs) {
		const expiresAt = ttlMs ? Date.now() + ttlMs : null;
		this._data.set(key, { value, expiresAt });
	}

	async delete(key) {
		this._data.delete(key);
	}
}

function bytesToHex(bytes) {
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

function timingSafeEqual(a, b) {
	if (!a || !b || a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i += 1) {
		diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return diff === 0;
}

export async function createCsrfToken() {
	const bytes = await getRandomBytes(32);
	return bytesToHex(bytes);
}

export async function issueCsrfToken({
	cookies,
	store,
	ttlMs = 60 * 60 * 1000,
	cookieName = CSRF_COOKIE_NAME,
	secure = true,
	sameSite = "lax",
	path = "/",
} = {}) {
	if (!cookies) {
		throw new Error("issueCsrfToken requires cookies");
	}

	const token = await createCsrfToken();
	if (store) {
		await store.set(token, true, ttlMs);
	}

	cookies.set(cookieName, token, {
		httpOnly: true,
		secure,
		sameSite,
		path,
		maxAge: Math.floor(ttlMs / 1000),
	});

	return token;
}

export async function validateCsrfRequest({
	request,
	cookies,
	store,
	headerName = CSRF_HEADER_NAME,
	cookieName = CSRF_COOKIE_NAME,
	checkExpiry = false,
} = {}) {
	if (!request || !cookies) {
		throw new Error("validateCsrfRequest requires request and cookies");
	}

	const headerToken = request.headers.get(headerName) || "";
	const cookieToken = cookies.get(cookieName) || "";

	if (!timingSafeEqual(headerToken, cookieToken)) {
		return false;
	}

	if (checkExpiry && store) {
		const record = await store.get(cookieToken);
		if (!record) return false;
	}

	return true;
}
