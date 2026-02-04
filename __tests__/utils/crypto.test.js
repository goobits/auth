import { describe, it, expect } from "vitest";
import {
	encryptTokens,
	decryptTokens,
	generateEncryptionKey,
	generateRandomUUID,
} from "../../src/utils/crypto.js";

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
});
