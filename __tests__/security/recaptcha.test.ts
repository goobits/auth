import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { verifyRecaptchaToken } from "../../src/security/recaptcha.ts";

type FetchMock = ReturnType<typeof vi.fn>;

function mockFetchResponse(body: Record<string, unknown>, ok = true) {
	return {
		ok,
		json: async () => body,
	} as Response;
}

describe("verifyRecaptchaToken", () => {
	let fetchSpy: FetchMock;
	const originalFetch = globalThis.fetch;
	const originalNodeEnv = process.env["NODE_ENV"];
	const originalSecret = process.env["RECAPTCHA_SECRET_KEY"];

	beforeEach(() => {
		fetchSpy = vi.fn();
		globalThis.fetch = fetchSpy as unknown as typeof fetch;
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		if (originalNodeEnv === undefined) {
			delete process.env["NODE_ENV"];
		} else {
			process.env["NODE_ENV"] = originalNodeEnv;
		}
		if (originalSecret === undefined) {
			delete process.env["RECAPTCHA_SECRET_KEY"];
		} else {
			process.env["RECAPTCHA_SECRET_KEY"] = originalSecret;
		}
	});

	it("returns false when no token is provided", async () => {
		const result = await verifyRecaptchaToken(null, { secretKey: "k" });
		expect(result).toBe(false);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("returns false in production when no secret key is configured", async () => {
		delete process.env["RECAPTCHA_SECRET_KEY"];
		process.env["NODE_ENV"] = "production";
		const result = await verifyRecaptchaToken("token");
		expect(result).toBe(false);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("returns allowInDevelopment value when no secret key is configured outside production", async () => {
		delete process.env["RECAPTCHA_SECRET_KEY"];
		process.env["NODE_ENV"] = "development";
		const allow = await verifyRecaptchaToken("token", { allowInDevelopment: true });
		expect(allow).toBe(true);
		const deny = await verifyRecaptchaToken("token", { allowInDevelopment: false });
		expect(deny).toBe(false);
	});

	it("returns true when Google reports success and no score is present", async () => {
		fetchSpy.mockResolvedValueOnce(mockFetchResponse({ success: true }));
		const result = await verifyRecaptchaToken("token", { secretKey: "k" });
		expect(result).toBe(true);
	});

	it("returns true when score meets minScore", async () => {
		fetchSpy.mockResolvedValueOnce(
			mockFetchResponse({ success: true, score: 0.9, action: "login" }),
		);
		const result = await verifyRecaptchaToken("token", {
			secretKey: "k",
			minScore: 0.5,
		});
		expect(result).toBe(true);
	});

	it("returns false when score is below minScore", async () => {
		fetchSpy.mockResolvedValueOnce(
			mockFetchResponse({ success: true, score: 0.2 }),
		);
		const result = await verifyRecaptchaToken("token", {
			secretKey: "k",
			minScore: 0.5,
		});
		expect(result).toBe(false);
	});

	it("returns false when the action does not match the expected action", async () => {
		fetchSpy.mockResolvedValueOnce(
			mockFetchResponse({ success: true, score: 0.9, action: "signup" }),
		);
		const result = await verifyRecaptchaToken("token", {
			secretKey: "k",
			action: "login",
		});
		expect(result).toBe(false);
	});

	it("returns false when Google reports success: false", async () => {
		fetchSpy.mockResolvedValueOnce(mockFetchResponse({ success: false }));
		const result = await verifyRecaptchaToken("token", { secretKey: "k" });
		expect(result).toBe(false);
	});

	it("returns false when the HTTP response is non-OK", async () => {
		fetchSpy.mockResolvedValueOnce(mockFetchResponse({ success: true }, false));
		const result = await verifyRecaptchaToken("token", { secretKey: "k" });
		expect(result).toBe(false);
	});

	it("returns false when fetch throws", async () => {
		fetchSpy.mockRejectedValueOnce(new Error("network"));
		const result = await verifyRecaptchaToken("token", { secretKey: "k" });
		expect(result).toBe(false);
	});
});
