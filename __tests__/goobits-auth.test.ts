import { describe, it, expect, vi } from "vitest";
import { GoobitsAuth } from "../src/goobits-auth.ts";
import type { OAuthProvider } from "../src/providers/base.ts";
import type { SessionAdapter } from "../src/adapters/session/base.ts";
import type { RequestEventLike } from "../src/types/auth.ts";
import type { Session, User } from "../src/types/index.ts";
import { createRequestEvent } from "./test-kit.ts";

function createProvider(): OAuthProvider {
	return {
		createAuthorizationURL: () => new URL("https://provider.example/auth"),
		getUserProfile: vi.fn(async () => ({
			profile: { id: "p1", email: "p1@example.com" },
			tokens: {
				accessToken: "token",
				refreshToken: null,
				scope: null,
				accessTokenExpiresAt: new Date().toISOString(),
			},
		})),
	};
}

function createSessionAdapter(validateResult: { session: Session | null; user: User | null }): SessionAdapter {
	return {
		createSession: vi.fn(async (userId: string) => ({
			id: `s:${userId}`,
			userId,
			expiresAt: new Date(Date.now() + 60_000),
		})),
		validateSession: vi.fn(async () => validateResult),
		invalidateSession: vi.fn(async () => {}),
		invalidateUserSessions: vi.fn(async () => {}),
		listSessions: vi.fn(async () => []),
		setSessionCookie: vi.fn(),
		deleteSessionCookie: vi.fn(),
	};
}

describe("GoobitsAuth", () => {
	it("populates event.locals.auth via handle()", async () => {
		const user: User = {
			id: "u1",
			email: "u1@example.com",
			name: "User One",
			avatar: null,
			emailVerified: true,
			role: "admin",
		};
		const session: Session = {
			id: "s1",
			userId: "u1",
			expiresAt: new Date(Date.now() + 60_000),
		};
		const auth = new GoobitsAuth({
			adapter: { session: createSessionAdapter({ session, user }) },
			providers: { google: { provider: createProvider() } },
		});
		const event = createRequestEvent({ url: "http://localhost/account" });
		event.cookies.set("session", "s1");

		const handle = auth.handle();
		await handle({
			event: event as never,
			resolve: async () => new Response("ok"),
		} as never);

		expect(event.locals.user?.id).toBe("u1");
		expect((event.locals as { auth?: { user: User } | null }).auth?.user.id).toBe("u1");
	});

	it("dispatches /auth/signin/:provider via handlers", async () => {
		const auth = new GoobitsAuth({
			adapter: {
				session: createSessionAdapter({ session: null, user: null }),
			},
			providers: { google: { provider: createProvider() } },
		});

		const event = createRequestEvent({
			url: "http://localhost/auth/signin/google",
			params: { provider: "google" },
		});
		await expect(auth.handlers.GET(event as never)).rejects.toMatchObject({
			status: 302,
			location: "https://provider.example/auth",
		});
	});

	it("dispatches POST /auth/callback/:provider via handlers", async () => {
		const auth = new GoobitsAuth({
			adapter: {
				session: createSessionAdapter({ session: null, user: null }),
			},
			providers: { apple: { provider: createProvider() } },
		});

		const event = createRequestEvent({
			url: "http://localhost/auth/callback/apple",
			method: "POST",
			form: { code: "test-code", state: "test-state" },
			params: { provider: "apple" },
		});

		await expect(auth.handlers.POST(event as never)).rejects.not.toMatchObject({
			status: 404,
		});
	});

	it("enforces requireRole", async () => {
		const user: User = {
			id: "u2",
			email: "u2@example.com",
			name: "User Two",
			avatar: null,
			emailVerified: true,
			role: "member",
		};
		const session: Session = {
			id: "s2",
			userId: "u2",
			expiresAt: new Date(Date.now() + 60_000),
		};
		const auth = new GoobitsAuth({
			adapter: { session: createSessionAdapter({ session, user }) },
		});
		const event = createRequestEvent({ url: "http://localhost/protected" });
		event.locals.session = session;
		event.locals.user = user;
		await expect(auth.requireRole(event, "admin")).rejects.toMatchObject({ status: 403 });
	});
});
