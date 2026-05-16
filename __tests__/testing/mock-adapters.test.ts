import { describe, expect, it } from "vitest";
import {
	MockSessionAdapter,
	MockTokenAdapter,
	MockUserAdapter,
} from "../../src/testing/index.ts";

describe("testing mock adapters", () => {
	it("creates and validates sessions", async () => {
		const users = new MockUserAdapter();
		await users.createUser({ id: "u1", email: "u1@example.com", name: "User One" });

		const sessions = new MockSessionAdapter();
		sessions.setUser({ id: "u1", email: "u1@example.com", name: "User One", avatar: null, emailVerified: false });

		const session = await sessions.createSession("u1");
		const result = await sessions.validateSession(session.id);
		expect(result.session?.id).toBe(session.id);
		expect(result.user?.id).toBe("u1");
	});

	it("stores and retrieves oauth tokens", async () => {
		const tokens = new MockTokenAdapter();
		await tokens.storeTokens("u1", "google", { accessToken: "token" });
		expect(await tokens.getTokens("u1", "google")).toEqual({ accessToken: "token" });
	});
});
