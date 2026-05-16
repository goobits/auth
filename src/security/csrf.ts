import { getRandomBytes } from "../utils/crypto.js";
import type { Cookies } from "@sveltejs/kit";
type CsrfStoreRecord = { value: boolean; expiresAt: number | null };

type CookiesLike = Pick<Cookies, "set" | "get" | "delete">;

export type CsrfStore = {
	get: (key: string) => Promise<CsrfStoreRecord | null>;
	set: (key: string, value: boolean, ttlMs?: number) => Promise<void>;
	delete: (key: string) => Promise<void>;
};

/** Default CSRF cookie name used by the security policy helpers. */
export const CSRF_COOKIE_NAME = "csrf-token";
/** Default CSRF request header name used for double-submit validation. */
export const CSRF_HEADER_NAME = "x-csrf-token";

/** In-memory CSRF token store for development, tests, and single-process apps. */
export class MemoryCsrfStore {
	#data: Map<string, CsrfStoreRecord>;

	constructor() {
		this.#data = new Map();
	}

	/** Look up a stored CSRF token record and expire stale entries. */
	async get(key: string): Promise<CsrfStoreRecord | null> {
		const record = this.#data.get(key);
		if (!record) return null;
		if (record.expiresAt && Date.now() > record.expiresAt) {
			this.#data.delete(key);
			return null;
		}
		return record;
	}

	/** Store a CSRF token marker with an optional TTL. */
	async set(key: string, value: boolean, ttlMs?: number): Promise<void> {
		const expiresAt = ttlMs ? Date.now() + ttlMs : null;
		this.#data.set(key, { value, expiresAt });
	}

	/** Delete a CSRF token marker. */
	async delete(key: string): Promise<void> {
		this.#data.delete(key);
	}
}

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

function timingSafeEqual(a: string, b: string): boolean {
	if (!a || !b || a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i += 1) {
		diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return diff === 0;
}

/** Create a random CSRF token encoded as lowercase hex. */
export async function createCsrfToken(): Promise<string> {
	const bytes = await getRandomBytes(32);
	return bytesToHex(bytes);
}

/**
 * Issue a CSRF token cookie and optionally persist it in a backing store.
 *
 * @param input Cookie, store, and token lifetime settings.
 * @returns The issued token value.
 */
export async function issueCsrfToken({
	cookies,
	store,
	ttlMs = 60 * 60 * 1000,
	cookieName = CSRF_COOKIE_NAME,
	secure = true,
	sameSite = "lax",
	path = "/",
}: {
	cookies?: CookiesLike;
	store?: CsrfStore;
	ttlMs?: number;
	cookieName?: string;
	secure?: boolean;
	sameSite?: "lax" | "strict" | "none";
	path?: string;
} = {}): Promise<string> {
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

/**
 * Validate a double-submit CSRF request against the configured cookie/header names.
 *
 * @param input Request, cookie, and optional store validation settings.
 * @returns Whether the request contains a valid CSRF token pair.
 */
export async function validateCsrfRequest({
	request,
	cookies,
	store,
	headerName = CSRF_HEADER_NAME,
	cookieName = CSRF_COOKIE_NAME,
	checkExpiry = false,
}: {
	request?: Request;
	cookies?: CookiesLike;
	store?: CsrfStore;
	headerName?: string;
	cookieName?: string;
	checkExpiry?: boolean;
} = {}): Promise<boolean> {
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
