import {
	generateRegistrationOptions,
	verifyRegistrationResponse,
	generateAuthenticationOptions,
	verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { encodeBase64url, decodeBase64url } from "@oslojs/encoding";
import { generateRandomUUID } from "../utils/crypto.ts";
import { sanitizeUser as defaultSanitizeUser } from "../utils/sanitize.ts";
import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import { jsonResponse, parseRequestData } from "../utils/http.ts";
import type { AuthLocals, RequestEventLike } from "../types/auth.ts";
import type { User } from "../types/index.ts";

function toUint8Array(value: unknown): Uint8Array {
	if (!value) return new Uint8Array();
	if (value instanceof Uint8Array) return value;
	if (value instanceof ArrayBuffer) return new Uint8Array(value);
	if (ArrayBuffer.isView(value)) {
		return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
	}
	if (typeof value === "string") {
		return decodeBase64url(value);
	}
	return new Uint8Array(value as ArrayBufferLike);
}

function encodeCredential(value: unknown): string {
	return encodeBase64url(toUint8Array(value));
}

export function createWebAuthnRegisterOptionsHandler(config: {
	webauthnAdapter: {
		listCredentials: (userId: string) => Promise<Record<string, unknown>[]>;
		createChallenge: (input: {
			challengeId: string;
			userId: string;
			challenge: string;
			type: string;
			expiresAt: Date;
		}) => Promise<void>;
	};
	rpName: string;
	rpID: string;
	timeout?: number;
	attestationType?: "none" | "indirect" | "direct" | "enterprise";
	authenticatorSelection?: Record<string, unknown>;
	supportedAlgorithmIDs?: number[];
	userVerification?: "preferred" | "required" | "discouraged";
	getUser?: (event: RequestEventLike) => User | null | Promise<User | null>;
}): RequestHandler {
	const {
		webauthnAdapter,
		rpName,
		rpID,
		timeout = 60_000,
		attestationType = "none",
		authenticatorSelection,
		supportedAlgorithmIDs,
		userVerification = "preferred",
		getUser = (event: RequestEventLike) => event.locals.user as User | null,
	} = config;

	if (!webauthnAdapter) {
		throw new Error("createWebAuthnRegisterOptionsHandler requires webauthnAdapter");
	}
	if (!rpID || !rpName) {
		throw new Error("createWebAuthnRegisterOptionsHandler requires rpID and rpName");
	}

	return async (event: RequestEventLike) => {
		const user = await getUser(event);
		if (!user || !user.id) {
			return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
		}

		const credentials = await webauthnAdapter.listCredentials(user.id);
		const excludeCredentials = credentials.map((cred) => ({
			id: (cred as { credentialId?: string; credential_id?: string }).credentialId ||
				(cred as { credential_id?: string }).credential_id,
			type: "public-key" as const,
			transports: (cred as { transports?: string[] | null }).transports || undefined,
		}));

		const options = generateRegistrationOptions({
			rpID,
			rpName,
			userID: String(user.id),
			userName: user.email || String(user.id),
			userDisplayName: user.name || user.email || String(user.id),
			timeout,
			attestationType,
			excludeCredentials,
			authenticatorSelection,
			supportedAlgorithmIDs,
			userVerification,
		} as Record<string, unknown>) as ReturnType<typeof generateRegistrationOptions>;

		const challengeId = await generateRandomUUID();
		const expiresAt = new Date(Date.now() + timeout);
		await webauthnAdapter.createChallenge({
			challengeId,
			userId: user.id,
			challenge: options.challenge,
			type: "registration",
			expiresAt,
		});

		return jsonResponse({ options, challengeId });
	};
}

export function createWebAuthnRegisterVerifyHandler(config: {
	webauthnAdapter: {
		getChallenge: (id: string) => Promise<Record<string, unknown> | null>;
		deleteChallenge: (id: string) => Promise<void>;
		createCredential: (input: {
			userId: string;
			credentialId: string;
			publicKey: string;
			counter: number;
			transports?: string[] | null;
			name?: string | null;
		}) => Promise<void>;
	};
	rpID: string;
	origin: string;
	requireUserVerification?: boolean;
	onCredentialCreated?: (input: {
		userId: string;
		credentialId: string;
		publicKey: string;
	}) => Promise<void> | void;
}) {
	const {
		webauthnAdapter,
		rpID,
		origin,
		requireUserVerification = false,
		onCredentialCreated,
	} = config;

	if (!webauthnAdapter) {
		throw new Error("createWebAuthnRegisterVerifyHandler requires webauthnAdapter");
	}
	if (!rpID || !origin) {
		throw new Error("createWebAuthnRegisterVerifyHandler requires rpID and origin");
	}

	return async (event: RequestEventLike) => {
		const data = await parseRequestData(event.request);
		const challengeId =
			typeof data.challengeId === "string" ? data.challengeId : "";
		const credential = data.credential as unknown;

		if (!challengeId || !credential) {
			return jsonResponse({ ok: false, error: "Invalid request" }, 400);
		}

		const challenge = await webauthnAdapter.getChallenge(challengeId);
		if (!challenge) {
			return jsonResponse({ ok: false, error: "Challenge not found" }, 400);
		}

		if (challenge.type && challenge.type !== "registration") {
			return jsonResponse({ ok: false, error: "Invalid challenge" }, 400);
		}

		if (challenge.expiresAt && new Date(challenge.expiresAt) < new Date()) {
			await webauthnAdapter.deleteChallenge(challengeId);
			return jsonResponse({ ok: false, error: "Challenge expired" }, 400);
		}

		const verification = await verifyRegistrationResponse({
			response: credential,
			expectedChallenge: String((challenge as { challenge?: string }).challenge ?? ""),
			expectedOrigin: origin,
			expectedRPID: rpID,
			requireUserVerification,
		} as Record<string, unknown>);

		if (!verification.verified) {
			return jsonResponse({ ok: false, error: "Registration failed" }, 400);
		}

		const { credential: regCredential } = verification.registrationInfo as {
			credential?: {
				id?: string;
				credentialID?: ArrayBuffer | Uint8Array | string;
				publicKey?: ArrayBuffer | Uint8Array | string;
				credentialPublicKey?: ArrayBuffer | Uint8Array | string;
				counter?: number;
			};
		};
		const credentialId = regCredential?.id || encodeCredential(regCredential?.credentialID);
		const publicKey = encodeCredential(regCredential?.publicKey || regCredential?.credentialPublicKey);
		const counter = regCredential?.counter ?? 0;

		await webauthnAdapter.createCredential({
			userId: String((challenge as { userId?: string }).userId ?? ""),
			credentialId,
			publicKey,
			counter,
			transports: (credential as { response?: { transports?: string[] } })?.response?.transports ?? null,
			name: data.name || null,
		});

		await webauthnAdapter.deleteChallenge(challengeId);

		if (onCredentialCreated) {
			await onCredentialCreated({
				userId: String((challenge as { userId?: string }).userId ?? ""),
				credentialId,
				publicKey,
			});
		}

		return jsonResponse({ ok: true, credentialId });
	};
}

export function createWebAuthnLoginOptionsHandler(config: {
	webauthnAdapter: {
		listCredentials: (userId: string) => Promise<Record<string, unknown>[]>;
		createChallenge: (input: {
			challengeId: string;
			userId: string | null;
			challenge: string;
			type: string;
			expiresAt: Date;
		}) => Promise<void>;
	};
	databaseAdapter?: { getUserByEmail: (email: string) => Promise<User | null> };
	rpID: string;
	timeout?: number;
	userVerification?: "preferred" | "required" | "discouraged";
}): RequestHandler {
	const {
		webauthnAdapter,
		databaseAdapter,
		rpID,
		timeout = 60_000,
		userVerification = "preferred",
	} = config;

	if (!webauthnAdapter) {
		throw new Error("createWebAuthnLoginOptionsHandler requires webauthnAdapter");
	}
	if (!rpID) {
		throw new Error("createWebAuthnLoginOptionsHandler requires rpID");
	}

	return async (event: RequestEventLike) => {
		const data = await parseRequestData(event.request);
		const email = typeof data.email === "string" ? data.email : "";
		let user = null;

		if (email && databaseAdapter) {
			user = await databaseAdapter.getUserByEmail(String(email).toLowerCase());
		}

		let allowCredentials;
		if (user) {
			const credentials = await webauthnAdapter.listCredentials(user.id);
			allowCredentials = credentials.map((cred) => ({
				id: (cred as { credentialId?: string; credential_id?: string }).credentialId ||
					(cred as { credential_id?: string }).credential_id,
				type: "public-key" as const,
				transports: (cred as { transports?: string[] | null }).transports || undefined,
			}));
		}

		const options = generateAuthenticationOptions({
			rpID,
			timeout,
			allowCredentials,
			userVerification,
		} as Record<string, unknown>) as ReturnType<typeof generateAuthenticationOptions>;

		const challengeId = await generateRandomUUID();
		const expiresAt = new Date(Date.now() + timeout);
		await webauthnAdapter.createChallenge({
			challengeId,
			userId: user?.id ?? null,
			challenge: options.challenge,
			type: "authentication",
			expiresAt,
		});

		return jsonResponse({ options, challengeId });
	};
}

export function createWebAuthnLoginVerifyHandler(config: {
	webauthnAdapter: {
		getChallenge: (id: string) => Promise<Record<string, unknown> | null>;
		deleteChallenge: (id: string) => Promise<void>;
		getCredential: (id: string) => Promise<Record<string, unknown> | null>;
		updateCredential: (id: string, updates: Record<string, unknown>) => Promise<void>;
	};
	databaseAdapter?: { getUserById: (id: string) => Promise<User | null> };
	sessionAdapter: {
		createSession: (userId: string) => Promise<{ id: string; expiresAt: Date }>;
		setSessionCookie?: (
			cookies: RequestEventLike["cookies"],
			session: { id: string; expiresAt: Date },
		) => void;
	};
	rpID: string;
	origin: string;
	redirectAfterLogin?: string;
	requireUserVerification?: boolean;
	onLogin?: (
		event: RequestEventLike,
		profile: { id: string; email?: string; name?: string },
		tokens: null,
		user: User | null,
	) => Promise<
		| { userId?: string | number; id?: string | number; user?: { id?: string | number } }
		| void
	>;
	sanitizeUser?: (user: User | null) => User | null;
}): RequestHandler {
	const {
		webauthnAdapter,
		databaseAdapter,
		sessionAdapter,
		rpID,
		origin,
		redirectAfterLogin = "/",
		requireUserVerification = false,
		onLogin,
		sanitizeUser = defaultSanitizeUser,
	} = config;

	if (!webauthnAdapter || !sessionAdapter) {
		throw new Error(
			"createWebAuthnLoginVerifyHandler requires webauthnAdapter and sessionAdapter",
		);
	}
	if (!rpID || !origin) {
		throw new Error("createWebAuthnLoginVerifyHandler requires rpID and origin");
	}

	return async (event: RequestEventLike) => {
		const data = await parseRequestData(event.request);
		const challengeId =
			typeof data.challengeId === "string" ? data.challengeId : "";
		const credential = data.credential as unknown;

		if (!challengeId || !credential) {
			return jsonResponse({ ok: false, error: "Invalid request" }, 400);
		}

		const challenge = await webauthnAdapter.getChallenge(challengeId);
		if (!challenge) {
			return jsonResponse({ ok: false, error: "Challenge not found" }, 400);
		}
		if (challenge.type && challenge.type !== "authentication") {
			return jsonResponse({ ok: false, error: "Invalid challenge" }, 400);
		}

		const credentialId = (credential as { id?: string }).id;
		const storedCredential = await webauthnAdapter.getCredential(credentialId);
		if (!storedCredential) {
			return jsonResponse({ ok: false, error: "Credential not found" }, 400);
		}

		const verification = await verifyAuthenticationResponse({
			response: credential,
			expectedChallenge: String((challenge as { challenge?: string }).challenge ?? ""),
			expectedOrigin: origin,
			expectedRPID: rpID,
			credential: {
				id: (storedCredential as { credentialId?: string }).credentialId as string,
				publicKey: toUint8Array((storedCredential as { publicKey?: unknown }).publicKey),
				counter: (storedCredential as { counter?: number }).counter ?? 0,
				transports: (storedCredential as { transports?: string[] | null }).transports || undefined,
			},
			requireUserVerification,
		} as Record<string, unknown>);

		if (!verification.verified) {
			return jsonResponse({ ok: false, error: "Authentication failed" }, 400);
		}

		await webauthnAdapter.updateCredential(
			(storedCredential as { credentialId?: string }).credentialId as string,
			{
				counter:
					(verification as { authenticationInfo?: { newCounter?: number } })
						.authenticationInfo?.newCounter ??
					(storedCredential as { counter?: number }).counter ??
					0,
			},
		);

		await webauthnAdapter.deleteChallenge(challengeId);

		let user = null;
		if (databaseAdapter && (storedCredential as { userId?: string }).userId) {
			user = await databaseAdapter.getUserById(
				String((storedCredential as { userId?: string }).userId),
			);
		}

		let userId = String((storedCredential as { userId?: string }).userId ?? "");

		if (onLogin) {
			const profile = {
				id: userId,
				email: user?.email,
				name: user?.name,
			};
			const hookResult = await onLogin(event, profile, null, user);
			if (hookResult?.userId) userId = hookResult.userId;
			if (hookResult?.id) userId = hookResult.id;
			if (hookResult?.user?.id) userId = hookResult.user.id;
		} else if (userId) {
			const session = await sessionAdapter.createSession(userId);
			if (sessionAdapter.setSessionCookie) {
				sessionAdapter.setSessionCookie(event.cookies, session);
			}
		} else {
			return jsonResponse({ ok: false, error: "User not found" }, 400);
		}

		if (event.request.method === "GET") {
			throw redirect(302, redirectAfterLogin);
		}

		return jsonResponse({ ok: true, user: sanitizeUser(user) });
	};
}
