import { describe, it, expect, vi } from "vitest";
import {
	createSessionListHandler,
	createSessionRevokeHandler,
} from "../../src/handlers/sessions.ts";
import type { SessionSummary } from "../../src/types/index.ts";

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
		const sessions = payload.sessions as Array<SessionSummary & { current: boolean }>;

		expect(payload.ok).toBe(true);
		expect(sessions.find((s) => s.id === "s1")?.current).toBe(true);
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

	it("returns 501 when bulk revoke is unsupported", async () => {
		const sessionAdapter = {
			invalidateSession: vi.fn(async () => {}),
		};

		const handler = createSessionRevokeHandler({ sessionAdapter });
		const response = await handler(createEvent({ all: true }));
		const payload = await response.json();

		expect(response.status).toBe(501);
		expect(payload.ok).toBe(false);
		expect(payload.error).toContain("not supported");
	});

	it("maps adapter failures to deterministic responses", async () => {
		const sessionAdapter = {
			listSessions: vi.fn(async () => [{ id: "s2", userId: "u1" }]),
			invalidateSession: vi.fn(async () => {
				throw new Error("db down");
			}),
		};

		const handler = createSessionRevokeHandler({ sessionAdapter });
		const response = await handler(createEvent({ id: "s2" }));
		const payload = await response.json();

		expect(response.status).toBe(500);
		expect(payload.ok).toBe(false);
		expect(payload.error).toBe("Failed to revoke session");
	});
});
