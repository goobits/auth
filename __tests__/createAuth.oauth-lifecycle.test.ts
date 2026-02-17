import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OAuthProfile, OAuthTokens } from "../src/types/index.ts";
import type { RequestEventLike } from "../src/types/auth.ts";

let capturedOnAuthenticated:
	| ((event: RequestEventLike, profile: OAuthProfile, tokens: OAuthTokens) => Promise<void>)
	| undefined;

vi.mock("../src/handlers/callback.ts", () => ({
	createCallbackHandler: (config: {
		onAuthenticated: (
			event: RequestEventLike,
			profile: OAuthProfile,
			tokens: OAuthTokens,
		) => Promise<void>;
	}) => {
		capturedOnAuthenticated = config.onAuthenticated;
		return vi.fn(async () => new Response("ok"));
	},
}));

import { createAuth } from "../src/createAuth.ts";

function createProvider() {
	return {
		createAuthorizationURL: () => new URL("https://example.com/auth"),
		getUserProfile: vi.fn(async () => ({
			profile: { id: "p1", email: "p1@example.com" },
			tokens: { accessToken: "token" },
		})),
	};
}

function createEvent(): RequestEventLike {
	return {
		request: new Request("http://localhost/auth/callback"),
		cookies: {
			get: vi.fn(),
			set: vi.fn(),
			delete: vi.fn(),
			getAll: vi.fn(() => []),
			serialize: vi.fn(),
		},
		params: { provider: "google" },
		locals: {},
		url: new URL("http://localhost/auth/callback"),
	};
}

describe("createAuth OAuth lifecycle", () => {
	beforeEach(() => {
		capturedOnAuthenticated = undefined;
	});

	it("creates a session when onLogin resolves a userId", async () => {
		const sessionAdapter = {
			createSession: vi.fn(async (userId: string) => ({ id: `s:${userId}`, userId })),
			setSessionCookie: vi.fn(),
			deleteSessionCookie: vi.fn(),
			validateSession: vi.fn(async () => ({ session: null, user: null })),
			invalidateSession: vi.fn(async () => {}),
			invalidateUserSessions: vi.fn(async () => {}),
			listSessions: vi.fn(async () => []),
		};

		createAuth({
			adapters: {
				session: sessionAdapter,
			},
			providers: { google: { provider: createProvider() } },
			hooks: {
				onLogin: async () => ({ userId: "hook-user" }),
			},
		});

		if (!capturedOnAuthenticated) throw new Error("Missing callback hook");
		await capturedOnAuthenticated(
			createEvent(),
			{ id: "google-id", email: "user@example.com" },
			{ accessToken: "token" },
		);

		expect(sessionAdapter.createSession).toHaveBeenCalledWith("hook-user");
		expect(sessionAdapter.setSessionCookie).toHaveBeenCalled();
	});

	it("fails when no principal can be resolved", async () => {
		const sessionAdapter = {
			createSession: vi.fn(async (userId: string) => ({ id: `s:${userId}`, userId })),
			setSessionCookie: vi.fn(),
			deleteSessionCookie: vi.fn(),
			validateSession: vi.fn(async () => ({ session: null, user: null })),
			invalidateSession: vi.fn(async () => {}),
			invalidateUserSessions: vi.fn(async () => {}),
			listSessions: vi.fn(async () => []),
		};

		createAuth({
			adapters: {
				session: sessionAdapter,
			},
			providers: { google: { provider: createProvider() } },
			hooks: {
				onLogin: async () => undefined,
			},
		});

		if (!capturedOnAuthenticated) throw new Error("Missing callback hook");
		await expect(
			capturedOnAuthenticated(
				createEvent(),
				{ id: "google-id", email: "user@example.com" },
				{ accessToken: "token" },
			),
		).rejects.toThrow("Unable to resolve authenticated principal");
	});
});
