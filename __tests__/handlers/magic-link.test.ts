import { describe, it, expect, vi } from "vitest";
import {
	createMagicLinkRequestHandler,
	createMagicLinkVerifyHandler,
} from "../../src/handlers/magic-link.ts";
import type { RequestEventLike } from "../../src/types/auth.ts";

type MagicLinkTokenRecord = {
	id?: string;
	userId: string | null;
	email: string;
	tokenHash: string;
	otpHash?: string | null;
	expiresAt: Date;
	metadata?: Record<string, unknown>;
};

function createEvent({
	method = "POST",
	body,
	url = "http://localhost/auth",
}: {
	method?: string;
	body?: unknown;
	url?: string;
} = {}) {
	const headers = new Headers();
	let requestBody = body;
	if (body && typeof body !== "string") {
		headers.set("content-type", "application/json");
		requestBody = JSON.stringify(body);
	}
	return {
		request: new Request(url, {
			method,
			body: (requestBody ?? null) as BodyInit | null,
			headers,
		}),
		cookies: {
			set: vi.fn(),
			delete: vi.fn(),
		},
		locals: {},
		url: new URL(url),
	};
}

function createMagicLinkAdapter() {
	const tokens = new Map<string, MagicLinkTokenRecord>();
	let counter = 0;
	return {
		createToken: async (token: Omit<MagicLinkTokenRecord, "id">) => {
			const id = `t${++counter}`;
			tokens.set(id, { id, ...token });
			return tokens.get(id);
		},
		findByTokenHash: async (tokenHash: string) => {
			for (const token of tokens.values()) {
				if (token.tokenHash === tokenHash) return token;
			}
			return null;
		},
		findByEmailAndOtpHash: async ({
			email,
			otpHash,
		}: {
			email: string;
			otpHash: string;
		}) => {
			for (const token of tokens.values()) {
				if (token.email === email && token.otpHash === otpHash) return token;
			}
			return null;
		},
		deleteById: async (id: string) => tokens.delete(id),
		deleteByEmail: async (email: string) => {
			for (const [id, token] of tokens.entries()) {
				if (token.email === email) tokens.delete(id);
			}
		},
		deleteByUserId: async (userId: string) => {
			for (const [id, token] of tokens.entries()) {
				if (token.userId === userId) tokens.delete(id);
			}
		},
		_tokens: tokens,
	};
}

describe("magic link handlers", () => {
	it("does not send email when user is missing and signup disabled", async () => {
		const magicLinkAdapter = createMagicLinkAdapter();
		const sendEmail = vi.fn();
		const handler = createMagicLinkRequestHandler({
			magicLinkAdapter,
			sendEmail,
			allowSignup: false,
		});

		const event = createEvent({ body: { email: "missing@example.com" } });
		const response = await handler(event as RequestEventLike);
		const payload = await response.json();

		expect(payload.ok).toBe(true);
		expect(sendEmail).not.toHaveBeenCalled();
		expect(magicLinkAdapter._tokens.size).toBe(0);
	});

	it("verifies token and creates session", async () => {
		const magicLinkAdapter = createMagicLinkAdapter();
		const sendEmail = vi.fn();
		const databaseAdapter = {
			getUserByEmail: vi.fn(async (email) => ({ id: "u1", email })),
			getUserById: vi.fn(async (id) => ({ id, email: "u1@example.com" })),
			updateUser: vi.fn(async () => {}),
		};
		const sessionAdapter = {
			createSession: vi.fn(async (userId) => ({ id: "s1", userId })),
			setSessionCookie: vi.fn(),
		};

		const requestHandler = createMagicLinkRequestHandler({
			magicLinkAdapter,
			databaseAdapter,
			sendEmail,
			exposeToken: true,
		});

		const requestEvent = createEvent({ body: { email: "u1@example.com" } });
		const requestResponse = await requestHandler(requestEvent as RequestEventLike);
		const { token } = await requestResponse.json();

		const verifyHandler = createMagicLinkVerifyHandler({
			magicLinkAdapter,
			databaseAdapter,
			sessionAdapter,
		});

		const verifyEvent = createEvent({ body: { token } });
		const verifyResponse = await verifyHandler(verifyEvent as RequestEventLike);
		const payload = await verifyResponse.json();

		expect(payload.ok).toBe(true);
		expect(sessionAdapter.createSession).toHaveBeenCalledWith("u1");
		expect(sessionAdapter.setSessionCookie).toHaveBeenCalled();
	});

	it("creates a session when onLogin returns a userId", async () => {
		const magicLinkAdapter = createMagicLinkAdapter();
		const sendEmail = vi.fn();
		const sessionAdapter = {
			createSession: vi.fn(async (userId: string) => ({ id: "s2", userId })),
			setSessionCookie: vi.fn(),
		};

		const requestHandler = createMagicLinkRequestHandler({
			magicLinkAdapter,
			sendEmail,
			allowSignup: true,
			exposeToken: true,
		});

		const requestResponse = await requestHandler(
			createEvent({ body: { email: "hook@example.com" } }) as RequestEventLike,
		);
		const { token } = await requestResponse.json();

		const verifyHandler = createMagicLinkVerifyHandler({
			magicLinkAdapter,
			sessionAdapter,
			onLogin: async () => ({ userId: "hook-user" }),
		});

		const verifyResponse = await verifyHandler(
			createEvent({ body: { token } }) as RequestEventLike,
		);
		const payload = await verifyResponse.json();

		expect(payload.ok).toBe(true);
		expect(sessionAdapter.createSession).toHaveBeenCalledWith("hook-user");
		expect(sessionAdapter.setSessionCookie).toHaveBeenCalled();
	});

	it("rejects verification when no principal can be resolved", async () => {
		const magicLinkAdapter = createMagicLinkAdapter();
		const sendEmail = vi.fn();
		const sessionAdapter = {
			createSession: vi.fn(async (userId: string) => ({ id: "s3", userId })),
			setSessionCookie: vi.fn(),
		};

		const requestHandler = createMagicLinkRequestHandler({
			magicLinkAdapter,
			sendEmail,
			allowSignup: true,
			exposeToken: true,
		});

		const requestResponse = await requestHandler(
			createEvent({ body: { email: "missing@example.com" } }) as RequestEventLike,
		);
		const { token } = await requestResponse.json();

		const verifyHandler = createMagicLinkVerifyHandler({
			magicLinkAdapter,
			sessionAdapter,
			onLogin: async () => undefined,
		});

		const verifyResponse = await verifyHandler(
			createEvent({ body: { token } }) as RequestEventLike,
		);
		const payload = await verifyResponse.json();

		expect(verifyResponse.status).toBe(401);
		expect(payload.ok).toBe(false);
		expect(payload.error).toContain("Unable to resolve authenticated principal");
		expect(sessionAdapter.createSession).not.toHaveBeenCalled();
	});

	it("redirects GET verification to redirectTo when provided", async () => {
		const magicLinkAdapter = createMagicLinkAdapter();
		const sendEmail = vi.fn();
		const databaseAdapter = {
			getUserByEmail: vi.fn(async (email) => ({ id: "u1", email })),
			getUserById: vi.fn(async (id) => ({ id, email: "u1@example.com" })),
			updateUser: vi.fn(async () => {}),
		};
		const sessionAdapter = {
			createSession: vi.fn(async (userId) => ({ id: "s1", userId })),
			setSessionCookie: vi.fn(),
		};

		const requestHandler = createMagicLinkRequestHandler({
			magicLinkAdapter,
			databaseAdapter,
			sendEmail,
			exposeToken: true,
		});

		const requestResponse = await requestHandler(
			createEvent({ body: { email: "u1@example.com", redirectTo: "/dashboard" } }) as RequestEventLike,
		);
		const { token } = await requestResponse.json();

		const verifyHandler = createMagicLinkVerifyHandler({
			magicLinkAdapter,
			databaseAdapter,
			sessionAdapter,
			redirectAfterLogin: "/fallback",
		});

		await expect(
			verifyHandler(
				createEvent({
					method: "GET",
					url: `http://localhost/auth/magic?token=${token}&redirectTo=%2Fdashboard`,
				}) as RequestEventLike,
			),
		).rejects.toMatchObject({
			status: 302,
			location: "/dashboard",
		});
	});
});
