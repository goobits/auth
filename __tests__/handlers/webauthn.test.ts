import { describe, it, expect, vi } from "vitest";
import {
	createWebAuthnRegisterOptionsHandler,
	createWebAuthnRegisterVerifyHandler,
	createWebAuthnLoginOptionsHandler,
	createWebAuthnLoginVerifyHandler,
} from "../../src/handlers/webauthn.ts";
import type { RequestEventLike } from "../../src/types/auth.ts";

type StoredChallenge = {
	challengeId: string;
	userId?: string | null;
	challenge: string;
	type: string;
	expiresAt: Date;
};

type StoredCredential = {
	userId: string;
	credentialId: string;
	publicKey: string;
	counter: number;
	transports?: string[] | null;
	name?: string | null;
};

vi.mock("@simplewebauthn/server", () => ({
	generateRegistrationOptions: vi.fn(() => ({
		challenge: "reg-challenge",
		rpID: "example.com",
		user: { id: "u1" },
	})),
	verifyRegistrationResponse: vi.fn(() => ({
		verified: true,
		registrationInfo: {
			credentialID: new Uint8Array([1, 2, 3]),
			credentialPublicKey: new Uint8Array([4, 5, 6]),
			counter: 0,
		},
	})),
	generateAuthenticationOptions: vi.fn(() => ({
		challenge: "auth-challenge",
		rpID: "example.com",
	})),
	verifyAuthenticationResponse: vi.fn(() => ({
		verified: true,
		authenticationInfo: {
			newCounter: 5,
		},
	})),
}));

function createEvent({
	method = "POST",
	body,
}: { method?: string; body?: unknown } = {}) {
	const headers = new Headers();
	let requestBody = body;
	if (body && typeof body !== "string") {
		headers.set("content-type", "application/json");
		requestBody = JSON.stringify(body);
	}
	return {
		request: new Request("http://localhost", {
			method,
			body: (requestBody ?? null) as BodyInit | null,
			headers,
		}),
		cookies: {
			set: vi.fn(),
		},
		locals: { user: { id: "u1", email: "u1@example.com", name: "User" } },
		url: new URL("http://localhost"),
	};
}

function createWebAuthnAdapter() {
	const challenges = new Map<string, StoredChallenge>();
	const credentials = new Map<string, StoredCredential>();
	return {
		createChallenge: async (challenge: StoredChallenge) => {
			challenges.set(challenge.challengeId, challenge);
		},
		getChallenge: async (id: string) => challenges.get(id) || null,
		deleteChallenge: async (id: string) => challenges.delete(id),
		createCredential: async (credential: StoredCredential) => {
			credentials.set(credential.credentialId, credential);
		},
		getCredential: async (id: string) => credentials.get(id) || null,
		listCredentials: async () => Array.from(credentials.values()),
		updateCredential: async (id: string, updates: Record<string, unknown>) => {
			const current = credentials.get(id);
			credentials.set(id, { ...current, ...updates });
		},
		deleteCredential: async (id: string) => credentials.delete(id),
		deleteUserCredentials: async () => {},
		_challenges: challenges,
		_credentials: credentials,
	};
}

describe("webauthn handlers", () => {
	it("stores registration challenge and returns options", async () => {
		const webauthnAdapter = createWebAuthnAdapter();
		const handler = createWebAuthnRegisterOptionsHandler({
			webauthnAdapter,
			rpName: "Example",
			rpID: "example.com",
		});

		const response = await handler(createEvent() as RequestEventLike);
		const payload = await response.json();

		expect(payload.options.challenge).toBe("reg-challenge");
		expect(webauthnAdapter._challenges.size).toBe(1);
	});

	it("verifies registration and saves credential", async () => {
		const webauthnAdapter = createWebAuthnAdapter();
		const challengeId = "c1";
		await webauthnAdapter.createChallenge({
			challengeId,
			userId: "u1",
			challenge: "reg-challenge",
			type: "registration",
			expiresAt: new Date(Date.now() + 1000),
		});

		const handler = createWebAuthnRegisterVerifyHandler({
			webauthnAdapter,
			rpID: "example.com",
			origin: "http://localhost",
		});

		const response = await handler(
			createEvent({
				body: { challengeId, credential: { id: "cred" } },
			}) as RequestEventLike,
		);
		const payload = await response.json();

		expect(payload.ok).toBe(true);
		expect(webauthnAdapter._credentials.size).toBe(1);
	});

	it("verifies authentication and creates session", async () => {
		const webauthnAdapter = createWebAuthnAdapter();
		const sessionAdapter = {
			createSession: vi.fn(async () => ({ id: "s1", userId: "u1" })),
			setSessionCookie: vi.fn(),
		};
		const databaseAdapter = {
			getUserById: vi.fn(async () => ({ id: "u1", email: "u1@example.com" })),
		};

		await webauthnAdapter.createChallenge({
			challengeId: "c2",
			userId: "u1",
			challenge: "auth-challenge",
			type: "authentication",
			expiresAt: new Date(Date.now() + 1000),
		});

		await webauthnAdapter.createCredential({
			userId: "u1",
			credentialId: "AQIDBAcI",
			publicKey: "AQID",
			counter: 0,
		});

		const handler = createWebAuthnLoginVerifyHandler({
			webauthnAdapter,
			databaseAdapter,
			sessionAdapter,
			rpID: "example.com",
			origin: "http://localhost",
		});

		const response = await handler(
			createEvent({
				body: { challengeId: "c2", credential: { id: "AQIDBAcI" } },
			}) as RequestEventLike,
		);
		const payload = await response.json();

		expect(payload.ok).toBe(true);
		expect(sessionAdapter.createSession).toHaveBeenCalledWith("u1");
		expect(sessionAdapter.setSessionCookie).toHaveBeenCalled();
	});

	it("creates a session when onLogin returns a userId", async () => {
		const webauthnAdapter = createWebAuthnAdapter();
		const sessionAdapter = {
			createSession: vi.fn(async () => ({ id: "s2", userId: "hook-user" })),
			setSessionCookie: vi.fn(),
		};

		await webauthnAdapter.createChallenge({
			challengeId: "c3",
			userId: "u1",
			challenge: "auth-challenge",
			type: "authentication",
			expiresAt: new Date(Date.now() + 1000),
		});
		await webauthnAdapter.createCredential({
			userId: "u1",
			credentialId: "AQIDBAcJ",
			publicKey: "AQID",
			counter: 0,
		});

		const handler = createWebAuthnLoginVerifyHandler({
			webauthnAdapter,
			sessionAdapter,
			rpID: "example.com",
			origin: "http://localhost",
			onLogin: async () => ({ userId: "hook-user" }),
		});

		const response = await handler(
			createEvent({
				body: { challengeId: "c3", credential: { id: "AQIDBAcJ" } },
			}) as RequestEventLike,
		);
		const payload = await response.json();

		expect(payload.ok).toBe(true);
		expect(sessionAdapter.createSession).toHaveBeenCalledWith("hook-user");
		expect(sessionAdapter.setSessionCookie).toHaveBeenCalled();
	});

	it("rejects login when resolved principal is invalid", async () => {
		const webauthnAdapter = createWebAuthnAdapter();
		const sessionAdapter = {
			createSession: vi.fn(async () => ({ id: "s3", userId: "u1" })),
			setSessionCookie: vi.fn(),
		};

		await webauthnAdapter.createChallenge({
			challengeId: "c4",
			userId: "",
			challenge: "auth-challenge",
			type: "authentication",
			expiresAt: new Date(Date.now() + 1000),
		});
		await webauthnAdapter.createCredential({
			userId: "",
			credentialId: "AQIDBAcK",
			publicKey: "AQID",
			counter: 0,
		});

		const handler = createWebAuthnLoginVerifyHandler({
			webauthnAdapter,
			sessionAdapter,
			rpID: "example.com",
			origin: "http://localhost",
		});

		const response = await handler(
			createEvent({
				body: { challengeId: "c4", credential: { id: "AQIDBAcK" } },
			}) as RequestEventLike,
		);
		const payload = await response.json();

		expect(response.status).toBe(401);
		expect(payload.ok).toBe(false);
		expect(payload.error).toContain("Unable to resolve authenticated principal");
		expect(sessionAdapter.createSession).not.toHaveBeenCalled();
	});
});
