import { encodeBase64url } from "@oslojs/encoding";
import { getRandomBytes, sha256Hex } from "./crypto.js";

export async function generateMagicLinkToken(bytesLength = 32) {
	const bytes = await getRandomBytes(bytesLength);
	return encodeBase64url(bytes);
}

export async function generateOtp(digits = 6) {
	const max = 10 ** digits;
	const bytes = await getRandomBytes(4);
	const value =
		((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
	const code = value % max;
	return String(code).padStart(digits, "0");
}

export async function hashToken(token) {
	return sha256Hex(token);
}
