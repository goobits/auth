import { describe, it, expect, vi } from "vitest";
import {
	createSessionListHandler,
	createSessionRevokeHandler,
} from "../../src/handlers/sessions.ts";

function createEvent(body: Record<string, unknown> | string | null = null) {
	const headers = new Headers();
	let requestBody = body;
	if (body && typeof body !== "string") {
		headers.set("content-type", "application/json");
		requestBody = JSON.stringify(body);
	}
	return {
		request: new Request("http://localhost", {
			method: "POST",
			body: (requestBody ?? null) as BodyInit | null,
			headers,
		}),
		cookies: {
			delete: vi.fn(),
		},
		locals: {
			user: { id: "u1" },
			session: { id: "s1" },
		},
		url: new URL("http://localhost"),
	};
}

describe("session handlers", () => {
	it("lists sessions and marks current", async () => {
		const sessionAdapter = {
			listSessions: vi.fn(async () => [
				{ id: "s1", userId: "u1", expiresAt: new Date() },
				{ id: "s2", userId: "u1", expiresAt: new Date() },
			]),
		};

		const handler = createSessionListHandler({ sessionAdapter });
		const response = await handler(createEvent());
		const payload = await response.json();

		expect(payload.ok).toBe(true);
		expect(payload.sessions.find((s: any) => s.id === "s1")?.current).toBe(true);
	});

	it("revokes other sessions", async () => {
		const sessionAdapter = {
			listSessions: vi.fn(async () => [
				{ id: "s1", userId: "u1" },
				{ id: "s2", userId: "u1" },
			]),
			invalidateSession: vi.fn(async () => {}),
		};

		const handler = createSessionRevokeHandler({ sessionAdapter });
		const response = await handler(createEvent({ others: true }));
		const payload = await response.json();

		expect(payload.ok).toBe(true);
		expect(sessionAdapter.invalidateSession).toHaveBeenCalledWith("s2");
	});
});
