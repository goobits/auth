import { describe, it, expect } from "vitest";
import {
	encryptTokens,
	decryptTokens,
	generateEncryptionKey,
	generateRandomUUID,
	sha256Hex,
} from "../../src/utils/crypto.ts";

describe("crypto utils", () => {
	it("generates a 32-byte encryption key", async () => {
		const key = await generateEncryptionKey();
		expect(key).toMatch(/^[0-9a-f]{64}$/);
	});

	it("encrypts and decrypts tokens", async () => {
		const key = await generateEncryptionKey();
		const tokens = { accessToken: "abc", refreshToken: "def" };
		const encrypted = await encryptTokens(tokens, key);
		const decrypted = await decryptTokens(encrypted, key);
		expect(decrypted).toEqual(tokens);
	});

	it("generates a UUID", async () => {
		const id = await generateRandomUUID();
		expect(id).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
		);
	});

	it("hashes strings with sha256", async () => {
		const hash = await sha256Hex("hello");
		expect(hash).toBe(
			"2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
		);
	});
});
