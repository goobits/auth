import { describe, expect, it } from "vitest";
import {
	requireAuthenticated,
	requireOwnership,
	requireRole,
} from "../../src/security/authorize.ts";
import type { RequestEventLike } from "../../src/types/auth.ts";
import type { User } from "../../src/types/index.ts";

function createEvent(user: User | null): RequestEventLike {
	return {
		request: new Request("http://localhost/resource", { method: "GET" }),
		cookies: {
			get: () => null,
			set: () => {},
			delete: () => {},
			getAll: () => [],
			serialize: () => "",
		},
		params: {},
		locals: { user, session: null },
		url: new URL("http://localhost/resource"),
	};
}

describe("security authorize helpers", () => {
	it("requires authentication", () => {
		expect(() => requireAuthenticated({ user: null, session: null })).toThrow(
			"Unauthorized",
		);
		expect(() =>
			requireAuthenticated({
				user: { id: "u1", email: "u1@example.com", name: "User", avatar: null, emailVerified: true },
				session: null,
			}),
		).not.toThrow();
	});

	it("enforces role and ownership checks", async () => {
		const event = createEvent({
			id: "u1",
			role: "admin",
			email: "u1@example.com",
			name: "User",
			avatar: null,
			emailVerified: true,
		} as User & { role: string });
		await expect(requireRole({ event }, ["admin"])).resolves.toBeUndefined();
		await expect(requireOwnership({ event }, "u1")).resolves.toBeUndefined();
		await expect(requireOwnership({ event }, "u2")).rejects.toThrow("Forbidden");
	});
});
