import { describe, it, expect, vi } from "vitest";
import {
	createMagicLinkRequestHandler,
	createMagicLinkVerifyHandler,
} from "../../src/handlers/magic-link.js";

function createEvent({ method = "POST", body, url = "http://localhost/auth" } = {}) {
	const headers = new Headers();
	let requestBody = body;
	if (body && typeof body !== "string") {
		headers.set("content-type", "application/json");
		requestBody = JSON.stringify(body);
	}
	return {
		request: new Request(url, { method, body: requestBody, headers }),
		cookies: {
			set: vi.fn(),
			delete: vi.fn(),
		},
		locals: {},
		url: new URL(url),
	};
}

function createMagicLinkAdapter() {
	const tokens = new Map();
	let counter = 0;
	return {
		createToken: async (token) => {
			const id = `t${++counter}`;
			tokens.set(id, { id, ...token });
			return tokens.get(id);
		},
		findByTokenHash: async (tokenHash) => {
			for (const token of tokens.values()) {
				if (token.tokenHash === tokenHash) return token;
			}
			return null;
		},
		findByEmailAndOtpHash: async ({ email, otpHash }) => {
			for (const token of tokens.values()) {
				if (token.email === email && token.otpHash === otpHash) return token;
			}
			return null;
		},
		deleteById: async (id) => tokens.delete(id),
		deleteByEmail: async (email) => {
			for (const [id, token] of tokens.entries()) {
				if (token.email === email) tokens.delete(id);
			}
		},
		deleteByUserId: async (userId) => {
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
		const response = await handler(event);
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
		const requestResponse = await requestHandler(requestEvent);
		const { token } = await requestResponse.json();

		const verifyHandler = createMagicLinkVerifyHandler({
			magicLinkAdapter,
			databaseAdapter,
			sessionAdapter,
		});

		const verifyEvent = createEvent({ body: { token } });
		const verifyResponse = await verifyHandler(verifyEvent);
		const payload = await verifyResponse.json();

		expect(payload.ok).toBe(true);
		expect(sessionAdapter.createSession).toHaveBeenCalledWith("u1");
		expect(sessionAdapter.setSessionCookie).toHaveBeenCalled();
	});
});
