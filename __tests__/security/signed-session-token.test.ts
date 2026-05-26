import { describe, expect, it } from "vitest";

import {
	createSignedSessionToken,
	verifySignedSessionToken,
} from "../../src/security/signed-session-token.ts";

describe("signed session tokens", () => {
	it("creates and verifies a signed token", async () => {
		const expiresAt = Date.now() + 60_000;
		const token = await createSignedSessionToken({
			subject: "sketch",
			secret: "test-secret",
			sessionId: "session-1",
			expiresAt,
		});

		await expect(verifySignedSessionToken(token, { secret: "test-secret" })).resolves.toEqual({
			subject: "sketch",
			sessionId: "session-1",
			expiresAt,
		});
	});

	it("rejects tampered and wrongly signed tokens", async () => {
		const token = await createSignedSessionToken({
			subject: "sketch",
			secret: "test-secret",
			sessionId: "session-1",
		});

		await expect(verifySignedSessionToken(`${token}x`, { secret: "test-secret" })).resolves.toBeNull();
		await expect(verifySignedSessionToken(token, { secret: "other-secret" })).resolves.toBeNull();
	});

	it("rejects expired tokens", async () => {
		const token = await createSignedSessionToken({
			subject: "sketch",
			secret: "test-secret",
			expiresAt: Date.now() - 1,
		});

		await expect(verifySignedSessionToken(token, { secret: "test-secret" })).resolves.toBeNull();
	});
});
