import { describe, it, expect } from "vitest";
import {
	generateMagicLinkToken,
	generateOtp,
	hashToken,
} from "../../src/handlers/magic-link.utils.ts";

describe("magic-link.utils", () => {
	describe("generateMagicLinkToken", () => {
		it("returns a base64url-encoded token (URL-safe alphabet, padding optional)", async () => {
			const token = await generateMagicLinkToken();
			expect(typeof token).toBe("string");
			expect(token.length).toBeGreaterThan(0);
			// URL-safe alphabet: no +/ chars, only A-Za-z0-9_-=
			expect(token).not.toContain("+");
			expect(token).not.toContain("/");
			expect(token).toMatch(/^[A-Za-z0-9_=-]+$/);
		});

		it("produces a different token on each call", async () => {
			const a = await generateMagicLinkToken();
			const b = await generateMagicLinkToken();
			expect(a).not.toBe(b);
		});

		it("respects the bytesLength parameter", async () => {
			const short = await generateMagicLinkToken(8);
			const long = await generateMagicLinkToken(64);
			expect(long.length).toBeGreaterThan(short.length);
		});
	});

	describe("generateOtp", () => {
		it("returns a zero-padded 6-digit code by default", async () => {
			const otp = await generateOtp();
			expect(otp).toMatch(/^\d{6}$/);
		});

		it("respects the digits parameter", async () => {
			const otp = await generateOtp(8);
			expect(otp).toMatch(/^\d{8}$/);
		});

		it("produces different codes on repeated calls (probabilistic)", async () => {
			const codes = new Set<string>();
			for (let i = 0; i < 10; i += 1) {
				codes.add(await generateOtp());
			}
			// At least 2 unique values in 10 tries — extremely conservative.
			expect(codes.size).toBeGreaterThan(1);
		});
	});

	describe("hashToken", () => {
		it("returns a 64-char hex string (sha-256)", async () => {
			const hash = await hashToken("hello");
			expect(hash).toMatch(/^[0-9a-f]{64}$/);
		});

		it("is deterministic for the same input", async () => {
			const a = await hashToken("same-token");
			const b = await hashToken("same-token");
			expect(a).toBe(b);
		});

		it("differs for different inputs", async () => {
			const a = await hashToken("alpha");
			const b = await hashToken("beta");
			expect(a).not.toBe(b);
		});
	});
});
