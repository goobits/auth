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
import type { RequestEvent, RequestHandler } from "@sveltejs/kit";

async function parseRequestData(request: Request): Promise<Record<string, any>> {
	const contentType = request.headers.get("content-type") || "";
	if (contentType.includes("application/json")) {
		return request.json().catch(() => ({}));
	}
	if (
		contentType.includes("application/x-www-form-urlencoded") ||
		contentType.includes("multipart/form-data")
	) {
		const form = await request.formData();
		return Object.fromEntries((form as any).entries());
	}
	return {};
}

function jsonResponse(payload: any, status: number = 200): Response {
	return new Response(JSON.stringify(payload), {
		status,
		headers: { "content-type": "application/json" },
	});
}

function toUint8Array(value: any): Uint8Array {
	if (!value) return new Uint8Array();
	if (value instanceof Uint8Array) return value;
	if (value instanceof ArrayBuffer) return new Uint8Array(value);
	if (ArrayBuffer.isView(value)) {
		return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
	}
	if (typeof value === "string") {
		return decodeBase64url(value);
	}
	return new Uint8Array(value);
}

function encodeCredential(value: any): string {
	return encodeBase64url(toUint8Array(value));
}

export function createWebAuthnRegisterOptionsHandler(config: any): RequestHandler {
	const {
		webauthnAdapter,
		rpName,
		rpID,
		timeout = 60_000,
		attestationType = "none",
		authenticatorSelection,
		supportedAlgorithmIDs,
		userVerification = "preferred",
		getUser = (event: any) => event.locals.user,
	} = config;

	if (!webauthnAdapter) {
		throw new Error("createWebAuthnRegisterOptionsHandler requires webauthnAdapter");
	}
	if (!rpID || !rpName) {
		throw new Error("createWebAuthnRegisterOptionsHandler requires rpID and rpName");
	}

	return async (event: RequestEvent | any) => {
		const user = await getUser(event);
		if (!user || !user.id) {
			return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
		}

		const credentials = await webauthnAdapter.listCredentials(user.id);
		const excludeCredentials = credentials.map((cred: any) => ({
			id: cred.credentialId || cred.credential_id,
			type: "public-key" as const,
			transports: cred.transports || undefined,
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
		} as any) as any;

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

export function createWebAuthnRegisterVerifyHandler(config: Record<string, any>) {
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

	return async (event: any) => {
		const data = await parseRequestData(event.request);
		const challengeId = data.challengeId;
		const credential = data.credential;

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
			expectedChallenge: challenge.challenge,
			expectedOrigin: origin,
			expectedRPID: rpID,
			requireUserVerification,
		} as any);

		if (!verification.verified) {
			return jsonResponse({ ok: false, error: "Registration failed" }, 400);
		}

		const { credential: regCredential } = verification.registrationInfo as any;
		const credentialId = regCredential?.id || encodeCredential(regCredential?.credentialID);
		const publicKey = encodeCredential(regCredential?.publicKey || regCredential?.credentialPublicKey);
		const counter = regCredential?.counter ?? 0;

		await webauthnAdapter.createCredential({
			userId: challenge.userId,
			credentialId,
			publicKey,
			counter,
			transports: credential.response?.transports ?? null,
			name: data.name || null,
		});

		await webauthnAdapter.deleteChallenge(challengeId);

		if (onCredentialCreated) {
			await onCredentialCreated({
				userId: challenge.userId,
				credentialId,
				publicKey,
			});
		}

		return jsonResponse({ ok: true, credentialId });
	};
}

export function createWebAuthnLoginOptionsHandler(config: any): RequestHandler {
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

	return async (event: RequestEvent | any) => {
		const data = await parseRequestData(event.request);
		const email = data.email;
		let user = null;

		if (email && databaseAdapter) {
			user = await databaseAdapter.getUserByEmail(String(email).toLowerCase());
		}

		let allowCredentials;
		if (user) {
			const credentials = await webauthnAdapter.listCredentials(user.id);
			allowCredentials = credentials.map((cred: any) => ({
				id: cred.credentialId || cred.credential_id,
				type: "public-key" as const,
				transports: cred.transports || undefined,
			}));
		}

		const options = generateAuthenticationOptions({
			rpID,
			timeout,
			allowCredentials,
			userVerification,
		} as any) as any;

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

export function createWebAuthnLoginVerifyHandler(config: any): RequestHandler {
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

	return async (event: RequestEvent | any) => {
		const data = await parseRequestData(event.request);
		const challengeId = data.challengeId;
		const credential = data.credential;

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

		const credentialId = credential.id;
		const storedCredential = await webauthnAdapter.getCredential(credentialId);
		if (!storedCredential) {
			return jsonResponse({ ok: false, error: "Credential not found" }, 400);
		}

		const verification = await verifyAuthenticationResponse({
			response: credential,
			expectedChallenge: challenge.challenge,
			expectedOrigin: origin,
			expectedRPID: rpID,
			credential: {
				id: storedCredential.credentialId,
				publicKey: toUint8Array(storedCredential.publicKey),
				counter: storedCredential.counter,
				transports: storedCredential.transports || undefined,
			},
			requireUserVerification,
		} as any);

		if (!verification.verified) {
			return jsonResponse({ ok: false, error: "Authentication failed" }, 400);
		}

		await webauthnAdapter.updateCredential(storedCredential.credentialId, {
			counter: (verification as any).authenticationInfo?.newCounter ?? storedCredential.counter,
		});

		await webauthnAdapter.deleteChallenge(challengeId);

		let user = null;
		if (databaseAdapter && storedCredential.userId) {
			user = await databaseAdapter.getUserById(storedCredential.userId);
		}

		let userId = storedCredential.userId;

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
