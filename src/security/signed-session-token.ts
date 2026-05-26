import { generateRandomUUID, sha256Hex, timingSafeEqual } from "../utils/crypto.js";

const DEFAULT_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export type SignedSessionTokenClaims = {
	subject: string;
	sessionId: string;
	expiresAt: number;
};

export type CreateSignedSessionTokenOptions = {
	subject: string;
	secret: string;
	sessionId?: string;
	expiresAt?: number;
	ttlMs?: number;
};

export type VerifySignedSessionTokenOptions = {
	secret: string;
};

function toBase64Url(value: string): string {
	const bytes = new TextEncoder().encode(value);
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): string {
	const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(
		Math.ceil(value.length / 4) * 4,
		"=",
	);
	const binary = atob(padded);
	const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
	return new TextDecoder().decode(bytes);
}

async function signPayload(payload: string, secret: string): Promise<string> {
	return sha256Hex(`${secret}.${payload}`);
}

/**
 * Create a signed, expiring session token with a caller-controlled subject.
 *
 * @param options - Token subject, signing secret, and optional expiry/session id.
 * @returns A signed token string safe for cookie storage.
 */
export async function createSignedSessionToken({
	subject,
	secret,
	sessionId,
	expiresAt,
	ttlMs = DEFAULT_SESSION_TTL_MS,
}: CreateSignedSessionTokenOptions): Promise<string> {
	if (!subject) {
		throw new Error("subject is required");
	}
	if (!secret) {
		throw new Error("secret is required");
	}

	const payload = JSON.stringify({
		sub: subject,
		sid: sessionId ?? (await generateRandomUUID()),
		exp: expiresAt ?? Date.now() + ttlMs,
	});
	const encodedPayload = toBase64Url(payload);
	const signature = await signPayload(encodedPayload, secret);
	return `${encodedPayload}.${signature}`;
}

/**
 * Verify a signed session token and return its claims.
 *
 * @param token - Signed token returned by createSignedSessionToken.
 * @param options - Verification secret.
 * @returns Token claims, or null when the token is invalid or expired.
 */
export async function verifySignedSessionToken(
	token: string,
	{ secret }: VerifySignedSessionTokenOptions,
): Promise<SignedSessionTokenClaims | null> {
	if (!token || !secret) {
		return null;
	}

	try {
		const [encodedPayload, signature] = token.split(".");
		if (!encodedPayload || !signature) {
			return null;
		}

		const expectedSignature = await signPayload(encodedPayload, secret);
		if (!timingSafeEqual(signature, expectedSignature)) {
			return null;
		}

		const data = JSON.parse(fromBase64Url(encodedPayload)) as Record<string, unknown>;
		if (
			typeof data["sub"] !== "string" ||
			typeof data["sid"] !== "string" ||
			typeof data["exp"] !== "number" ||
			data["exp"] < Date.now()
		) {
			return null;
		}

		return {
			subject: data["sub"],
			sessionId: data["sid"],
			expiresAt: data["exp"],
		};
	} catch {
		return null;
	}
}
