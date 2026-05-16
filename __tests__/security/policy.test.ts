import { describe, expect, it } from "vitest";
import { applySecurityPolicy } from "../../src/security/policy.ts";
import { MemoryCsrfStore } from "../../src/security/csrf.ts";
import type { RequestEventLike } from "../../src/types/auth.ts";

function createCookies(initial: Record<string, string> = {}) {
	const data = new Map(Object.entries(initial));
	return {
		get: (name: string) => data.get(name) ?? null,
		set: (name: string, value: string) => {
			data.set(name, value);
		},
		delete: (name: string) => {
			data.delete(name);
		},
		getAll: () => [],
		serialize: () => "",
	};
}

function createEvent({
	method = "POST",
	headers = {},
	cookies = createCookies(),
}: {
	method?: string;
	headers?: Record<string, string>;
	cookies?: ReturnType<typeof createCookies>;
} = {}): RequestEventLike {
	return {
		request: new Request("http://localhost/auth/test", { method, headers }),
		cookies,
		params: {},
		locals: { user: null, session: null },
		url: new URL("http://localhost/auth/test"),
		getClientAddress: () => "127.0.0.1",
	};
}

describe("security policy wrapper", () => {
	it("blocks missing csrf token when required", async () => {
		const handler = applySecurityPolicy({
			handler: async () => new Response(JSON.stringify({ ok: true })),
			routeId: "magic.request",
			settings: {
				csrf: {
					mode: "required",
					cookieName: "csrf-token",
					headerName: "x-csrf-token",
					checkExpiry: false,
					store: new MemoryCsrfStore(),
				},
				rateLimit: {
					mode: "off",
					max: 10,
					windowMs: 60_000,
					keyPrefix: "test",
					trustProxyHeader: false,
				},
				audit: { mode: "off" },
				routes: {},
			},
		});
		const response = await handler(createEvent() as Parameters<typeof handler>[0]);
		expect(response.status).toBe(403);
	});

	it("rate limits repeated requests", async () => {
		const cookies = createCookies({
			"csrf-token": "token",
		});
		const handler = applySecurityPolicy({
			handler: async () => new Response(JSON.stringify({ ok: true })),
			routeId: "magic.request",
			settings: {
				csrf: {
					mode: "required",
					cookieName: "csrf-token",
					headerName: "x-csrf-token",
					checkExpiry: false,
					store: new MemoryCsrfStore(),
				},
				rateLimit: {
					mode: "required",
					max: 1,
					windowMs: 60_000,
					keyPrefix: "test",
					trustProxyHeader: false,
				},
				audit: { mode: "off" },
				routes: {},
			},
		});
		const first = await handler(
			createEvent({
				headers: { "x-csrf-token": "token" },
				cookies,
			}) as Parameters<typeof handler>[0],
		);
		const second = await handler(
			createEvent({
				headers: { "x-csrf-token": "token" },
				cookies,
			}) as Parameters<typeof handler>[0],
		);
		expect(first.status).toBe(200);
		expect(second.status).toBe(429);
	});
});
