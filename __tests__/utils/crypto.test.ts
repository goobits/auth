import { afterEach, describe, expect, it, vi } from "vitest";
import { decryptTokens, encryptTokens } from "../../src/utils/crypto.ts";
import { setLogger } from "../../src/utils/logger.ts";

describe("crypto utils", () => {
	afterEach(() => {
		setLogger(null);
	});
	it("round-trips token encryption/decryption", async () => {
		const key = "a".repeat(64);
		const payload = { accessToken: "abc", refreshToken: "def" };
		const encrypted = await encryptTokens(payload, key);
		const decrypted = await decryptTokens<typeof payload>(encrypted, key);
		expect(decrypted).toEqual(payload);
	});

	it("logs encryption errors via the logger", async () => {
		const error = vi.fn();
		setLogger({ error });
		await expect(encryptTokens({ a: 1 }, "bad")).rejects.toThrow();
		expect(error).toHaveBeenCalled();
	});

	it("logs decryption errors via the logger", async () => {
		const error = vi.fn();
		setLogger({ error });
		const result = await decryptTokens("not-json", "bad");
		expect(result).toBeNull();
		expect(error).toHaveBeenCalled();
	});
});
