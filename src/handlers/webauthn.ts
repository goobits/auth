import {
	generateAuthenticationOptions,
	generateRegistrationOptions,
	verifyAuthenticationResponse,
	verifyRegistrationResponse,
	type AuthenticationResponseJSON,
	type AuthenticatorTransportFuture,
	type GenerateAuthenticationOptionsOpts,
	type GenerateRegistrationOptionsOpts,
	type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { decodeBase64url, encodeBase64url } from "@oslojs/encoding";
import { redirect } from "@sveltejs/kit";
import { z } from "zod";
import type { RequestHandler } from "@sveltejs/kit";
import type { SessionAdapter } from "../adapters/session/base.js";
import type { WebAuthnAdapter } from "../adapters/webauthn/base.js";
import type { AuthHooks, RequestEventLike } from "../types/auth.js";
import type { User } from "../types/index.js";
import { generateRandomUUID } from "../utils/crypto.js";
import { jsonResponse, parseRequestDataWithSchema } from "../utils/http.js";
import { sanitizeUser as defaultSanitizeUser } from "../utils/sanitize.js";
import { ensureSessionAfterLogin, type OnLoginMode } from "../utils/session-lifecycle.js";
import { AuthPrincipalResolutionError } from "../errors/auth.js";
import { auditAuthEvent } from "../security/audit.js";

type ChallengeRecord = {
	id: string;
	userId: string | null;
	challenge: string;
	type: string;
	expiresAt: string | number | Date;
};

type CredentialRecord = {
	credentialId: string;
	userId: string;
	publicKey: string;
	counter: number;
	transports?: string[] | null;
};

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
	if (Array.isArray(value) && value.every((entry) => typeof entry === "number")) {
		return Uint8Array.from(value);
	}
	return new Uint8Array();
}

function encodeCredential(value: unknown): string {
	return encodeBase64url(toUint8Array(value));
}

const registrationResponseSchema = z.custom<RegistrationResponseJSON>(
	(value: unknown): value is RegistrationResponseJSON =>
		typeof value === "object" &&
		value !== null &&
		typeof (value as Record<string, unknown>)["id"] === "string" &&
		((typeof (value as Record<string, unknown>)["rawId"] === "string" &&
			(value as Record<string, unknown>)["type"] === "public-key") ||
			!(("rawId" in (value as Record<string, unknown>)) || ("type" in (value as Record<string, unknown>)))),
);

const authenticationResponseSchema = z.custom<AuthenticationResponseJSON>(
	(value: unknown): value is AuthenticationResponseJSON =>
		typeof value === "object" &&
		value !== null &&
		typeof (value as Record<string, unknown>)["id"] === "string" &&
		((typeof (value as Record<string, unknown>)["rawId"] === "string" &&
			(value as Record<string, unknown>)["type"] === "public-key") ||
			!(("rawId" in (value as Record<string, unknown>)) || ("type" in (value as Record<string, unknown>)))),
);

const registerVerifyRequestSchema = z.object({
	challengeId: z.string().min(1),
	credential: registrationResponseSchema,
	name: z.string().optional(),
});

const loginOptionsRequestSchema = z.object({
	email: z.string().optional(),
});

const loginVerifyRequestSchema = z.object({
	challengeId: z.string().min(1),
	credential: authenticationResponseSchema,
});

function toChallengeRecord(value: Record<string, unknown> | null): ChallengeRecord | null {
	if (!value) return null;
	const id = value["id"] ?? value["challengeId"];
	const userId = value["userId"];
	const challenge = value["challenge"];
	const type = value["type"];
	const expiresAt = value["expiresAt"];
	if (typeof id !== "string") return null;
	if (userId !== null && userId !== undefined && typeof userId !== "string") {
		return null;
	}
	if (typeof challenge !== "string") return null;
	if (typeof type !== "string") return null;
	if (
		typeof expiresAt !== "string" &&
		typeof expiresAt !== "number" &&
		!(expiresAt instanceof Date)
	) {
		return null;
	}
	return {
		id,
		userId: userId ?? null,
		challenge,
		type,
		expiresAt,
	};
}

function toCredentialRecord(value: Record<string, unknown> | null): CredentialRecord | null {
	if (!value) return null;
	const credentialId = value["credentialId"];
	const userId = value["userId"];
	const publicKey = value["publicKey"];
	const counter = value["counter"];
	const transports = value["transports"];
	if (typeof credentialId !== "string") return null;
	if (typeof userId !== "string") return null;
	if (typeof publicKey !== "string") return null;
	if (typeof counter !== "number") return null;
	if (
		transports !== undefined &&
		transports !== null &&
		(!Array.isArray(transports) || transports.some((entry) => typeof entry !== "string"))
	) {
		return null;
	}
	return {
		credentialId,
		userId,
		publicKey,
		counter,
		transports: transports ?? null,
	};
}

function credentialDescriptorFromRecord(
	cred: Record<string, unknown>,
): { id: string; transports?: AuthenticatorTransportFuture[] } | null {
	const id = cred["credentialId"] ?? cred["credential_id"];
	const transports = cred["transports"];
	if (typeof id !== "string") return null;
	if (transports !== undefined && transports !== null) {
		if (!Array.isArray(transports) || transports.some((entry) => typeof entry !== "string")) {
			return { id };
		}
		const filtered = transports.filter((entry): entry is AuthenticatorTransportFuture =>
			entry === "ble" ||
			entry === "cable" ||
			entry === "hybrid" ||
			entry === "internal" ||
			entry === "nfc" ||
			entry === "smart-card" ||
			entry === "usb",
		);
		return filtered.length > 0 ? { id, transports: filtered } : { id };
	}
	return { id };
}

function toAuthenticatorTransports(
	transports: string[] | null | undefined,
): AuthenticatorTransportFuture[] | undefined {
	if (!transports) return undefined;
	const filtered = transports.filter((entry): entry is AuthenticatorTransportFuture =>
		entry === "ble" ||
		entry === "cable" ||
		entry === "hybrid" ||
		entry === "internal" ||
		entry === "nfc" ||
		entry === "smart-card" ||
		entry === "usb",
	);
	return filtered.length > 0 ? filtered : undefined;
}

export type WebAuthnRegisterOptionsHandlerConfig = {
	webauthnAdapter: Pick<WebAuthnAdapter, "listCredentials" | "createChallenge">;
	rpName: string;
	rpID: string;
	timeout?: number;
	attestationType?: GenerateRegistrationOptionsOpts["attestationType"];
	authenticatorSelection?: GenerateRegistrationOptionsOpts["authenticatorSelection"];
	supportedAlgorithmIDs?: GenerateRegistrationOptionsOpts["supportedAlgorithmIDs"];
	userVerification?: "preferred" | "required" | "discouraged";
	getUser?: (event: RequestEventLike) => User | null | Promise<User | null>;
};

export function createWebAuthnRegisterOptionsHandler(
	config: WebAuthnRegisterOptionsHandlerConfig,
): RequestHandler {
	const {
		webauthnAdapter,
		rpName,
		rpID,
		timeout = 60_000,
		attestationType = "none",
		authenticatorSelection,
		supportedAlgorithmIDs,
		userVerification = "preferred",
		getUser = (event: RequestEventLike) => event.locals.user ?? null,
	} = config;

	if (!rpID || !rpName) {
		throw new Error("createWebAuthnRegisterOptionsHandler requires rpID and rpName");
	}

	return async (event: RequestEventLike) => {
		const user = await getUser(event);
		if (!user || !user.id) {
			return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
		}

		const credentials = await webauthnAdapter.listCredentials(user.id);
		const excludeCredentials = credentials
			.map((cred) => credentialDescriptorFromRecord(cred))
			.filter(
				(cred): cred is { id: string; transports?: AuthenticatorTransportFuture[] } =>
					cred !== null,
			);

		const optionsInput: GenerateRegistrationOptionsOpts = {
			rpID,
			rpName,
			userID: new TextEncoder().encode(String(user.id)),
			userName: user.email || String(user.id),
			userDisplayName: user.name || user.email || String(user.id),
			timeout,
			attestationType,
			excludeCredentials,
		};
		if (authenticatorSelection) {
			optionsInput.authenticatorSelection = authenticatorSelection;
		}
		if (supportedAlgorithmIDs) {
			optionsInput.supportedAlgorithmIDs = supportedAlgorithmIDs;
		}
		const options = await generateRegistrationOptions(optionsInput);

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

export type WebAuthnRegisterVerifyHandlerConfig = {
	webauthnAdapter: Pick<WebAuthnAdapter, "getChallenge" | "deleteChallenge" | "createCredential">;
	rpID: string;
	origin: string;
	requireUserVerification?: boolean;
	onCredentialCreated?: (input: {
		userId: string;
		credentialId: string;
		publicKey: string;
	}) => Promise<void> | void;
};

export function createWebAuthnRegisterVerifyHandler(
	config: WebAuthnRegisterVerifyHandlerConfig,
): RequestHandler {
	const {
		webauthnAdapter,
		rpID,
		origin,
		requireUserVerification = false,
		onCredentialCreated,
	} = config;

	if (!rpID || !origin) {
		throw new Error("createWebAuthnRegisterVerifyHandler requires rpID and origin");
	}

	return async (event: RequestEventLike) => {
		const data = await parseRequestDataWithSchema(event.request, registerVerifyRequestSchema);
		if (!data) {
			return jsonResponse({ ok: false, error: "Invalid request" }, 400);
		}
		const { challengeId, credential, name } = data;

		const challengeRaw = await webauthnAdapter.getChallenge(challengeId);
		const challenge = toChallengeRecord(challengeRaw);
		if (!challenge) {
			return jsonResponse({ ok: false, error: "Challenge not found" }, 400);
		}
		if (challenge.type !== "registration") {
			return jsonResponse({ ok: false, error: "Invalid challenge" }, 400);
		}

		if (new Date(challenge.expiresAt) < new Date()) {
			await webauthnAdapter.deleteChallenge(challengeId);
			return jsonResponse({ ok: false, error: "Challenge expired" }, 400);
		}

		const verification = await verifyRegistrationResponse({
			response: credential,
			expectedChallenge: challenge.challenge,
			expectedOrigin: origin,
			expectedRPID: rpID,
			requireUserVerification,
		});

		if (!verification.verified || !verification.registrationInfo) {
			return jsonResponse({ ok: false, error: "Registration failed" }, 400);
		}

		const registrationInfoRecord = verification.registrationInfo as Record<string, unknown>;
		const regCredentialRecord =
			(typeof registrationInfoRecord["credential"] === "object" &&
			registrationInfoRecord["credential"] !== null
				? registrationInfoRecord["credential"]
				: registrationInfoRecord) as Record<string, unknown>;
		const credentialIdRaw =
			regCredentialRecord["id"] ?? regCredentialRecord["credentialID"];
		const publicKeyRaw =
			regCredentialRecord["publicKey"] ?? regCredentialRecord["credentialPublicKey"];
		const counterRaw = regCredentialRecord["counter"];
		const credentialId =
			typeof credentialIdRaw === "string"
				? credentialIdRaw
				: encodeCredential(credentialIdRaw);
		const publicKey = encodeCredential(publicKeyRaw);
		const counter = typeof counterRaw === "number" ? counterRaw : 0;
		const userId = challenge.userId;
		if (!userId) {
			return jsonResponse({ ok: false, error: "Challenge user missing" }, 400);
		}

		await webauthnAdapter.createCredential({
			userId,
			credentialId,
			publicKey,
			counter,
			transports:
				credential.response && "transports" in credential.response
					? (credential.response.transports ?? null)
					: null,
			name: name ?? null,
		});

		await webauthnAdapter.deleteChallenge(challengeId);

		if (onCredentialCreated) {
			await onCredentialCreated({ userId, credentialId, publicKey });
		}

		return jsonResponse({ ok: true, credentialId });
	};
}

export type WebAuthnLoginOptionsHandlerConfig = {
	webauthnAdapter: Pick<WebAuthnAdapter, "listCredentials" | "createChallenge">;
	databaseAdapter?: { getUserByEmail: (email: string) => Promise<User | null> };
	rpID: string;
	timeout?: number;
	userVerification?: GenerateAuthenticationOptionsOpts["userVerification"];
};

export function createWebAuthnLoginOptionsHandler(
	config: WebAuthnLoginOptionsHandlerConfig,
): RequestHandler {
	const {
		webauthnAdapter,
		databaseAdapter,
		rpID,
		timeout = 60_000,
		userVerification = "preferred",
	} = config;

	if (!rpID) {
		throw new Error("createWebAuthnLoginOptionsHandler requires rpID");
	}

	return async (event: RequestEventLike) => {
		const data = await parseRequestDataWithSchema(event.request, loginOptionsRequestSchema);
		const email = data?.email ? data.email.toLowerCase() : "";
		let user: User | null = null;

		if (email && databaseAdapter) {
			user = await databaseAdapter.getUserByEmail(email);
		}

		let allowCredentials:
			| GenerateAuthenticationOptionsOpts["allowCredentials"]
			| undefined;
		if (user) {
			const credentials = await webauthnAdapter.listCredentials(user.id);
			allowCredentials = credentials
				.map((cred) => credentialDescriptorFromRecord(cred))
				.filter(
					(cred): cred is { id: string; transports?: AuthenticatorTransportFuture[] } =>
						cred !== null,
				);
		}

		const optionsInput: GenerateAuthenticationOptionsOpts = {
			rpID,
			timeout,
			userVerification,
		};
		if (allowCredentials) {
			optionsInput.allowCredentials = allowCredentials;
		}
		const options = await generateAuthenticationOptions(optionsInput);

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

export type WebAuthnLoginVerifyHandlerConfig = {
	webauthnAdapter: Pick<
		WebAuthnAdapter,
		"getChallenge" | "deleteChallenge" | "getCredential" | "updateCredential"
	>;
	databaseAdapter?: { getUserById: (id: string) => Promise<User | null> };
	sessionAdapter: Pick<SessionAdapter, "createSession" | "setSessionCookie">;
	rpID: string;
	origin: string;
	redirectAfterLogin?: string;
	requireUserVerification?: boolean;
	onLogin?: AuthHooks["onLogin"];
	sanitizeUser?: (user: User | null) => User | null;
	autoCreateSession?: boolean;
	onLoginMode?: OnLoginMode;
};

export function createWebAuthnLoginVerifyHandler(
	config: WebAuthnLoginVerifyHandlerConfig,
): RequestHandler {
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
		autoCreateSession = true,
		onLoginMode = "augment",
	} = config;

	if (!rpID || !origin) {
		throw new Error("createWebAuthnLoginVerifyHandler requires rpID and origin");
	}

	return async (event: RequestEventLike) => {
		const data = await parseRequestDataWithSchema(event.request, loginVerifyRequestSchema);
		if (!data) {
			return jsonResponse({ ok: false, error: "Invalid request" }, 400);
		}
		const { challengeId, credential } = data;

		const challengeRaw = await webauthnAdapter.getChallenge(challengeId);
		const challenge = toChallengeRecord(challengeRaw);
		if (!challenge) {
			auditAuthEvent("webauthn.challenge_missing", { challengeId });
			return jsonResponse({ ok: false, error: "Challenge not found" }, 400);
		}
		if (challenge.type !== "authentication") {
			auditAuthEvent("webauthn.challenge_invalid_type", { challengeId });
			return jsonResponse({ ok: false, error: "Invalid challenge" }, 400);
		}

		const storedCredentialRaw = await webauthnAdapter.getCredential(credential.id);
		const storedCredential = toCredentialRecord(storedCredentialRaw);
		if (!storedCredential) {
			auditAuthEvent("webauthn.credential_missing", {
				credentialId: credential.id,
			});
			return jsonResponse({ ok: false, error: "Credential not found" }, 400);
		}

		const credentialInput = {
			id: storedCredential.credentialId,
			publicKey: new Uint8Array(toUint8Array(storedCredential.publicKey)),
			counter: storedCredential.counter,
		};
		const transports = toAuthenticatorTransports(storedCredential.transports);
		const verification = await verifyAuthenticationResponse({
			response: credential,
			expectedChallenge: challenge.challenge,
			expectedOrigin: origin,
			expectedRPID: rpID,
			credential: transports
				? { ...credentialInput, transports }
				: credentialInput,
			requireUserVerification,
		});

		if (!verification.verified) {
			auditAuthEvent("webauthn.authentication_failed", {
				credentialId: credential.id,
			});
			return jsonResponse({ ok: false, error: "Authentication failed" }, 400);
		}

		await webauthnAdapter.updateCredential(storedCredential.credentialId, {
			counter:
				verification.authenticationInfo.newCounter ?? storedCredential.counter,
		});
		await webauthnAdapter.deleteChallenge(challengeId);

		const user = databaseAdapter
			? await databaseAdapter.getUserById(storedCredential.userId)
			: null;
		let userId = storedCredential.userId;

		if (onLogin) {
			const profile = {
				id: userId,
				email: user?.email ?? "",
				...(user?.name ? { name: user.name } : {}),
			};
			const hookResult = await onLogin(event, profile, null, user);
			if (hookResult?.userId) userId = String(hookResult.userId);
		}
		try {
			userId = await ensureSessionAfterLogin({
				event,
				sessionAdapter,
				userId,
				autoCreateSession,
				onLoginMode,
			});
		} catch (error) {
			if (error instanceof AuthPrincipalResolutionError) {
				return jsonResponse({ ok: false, error: error.message }, error.status);
			}
			throw error;
		}

		if (event.request.method === "GET") {
			throw redirect(302, redirectAfterLogin);
		}

		return jsonResponse({ ok: true, user: sanitizeUser(user) });
	};
}
