import {
	type AuthenticatorTransportFuture,
	generateAuthenticationOptions,
	type GenerateAuthenticationOptionsOpts,
	generateRegistrationOptions,
	type GenerateRegistrationOptionsOpts,
	verifyAuthenticationResponse,
	verifyRegistrationResponse
} from '@simplewebauthn/server'
import { redirect, type RequestHandler } from '@sveltejs/kit'

import type { SessionAdapter } from '../adapters/session/SessionAdapter.ts'
import type { WebAuthnAdapter } from '../adapters/webauthn/WebAuthnAdapter.ts'
import { AuthPrincipalResolutionError } from '../errors/AuthPrincipalResolutionError.ts'
import { auditAuthEvent } from '../security/audit.ts'
import type { AuthHooks, OnLoginMode, RequestEventLike } from '../types/auth.ts'
import type { User } from '../types/index.ts'
import { generateRandomUUID } from '../utils/crypto.ts'
import { jsonResponse, parseRequestDataWithSchema } from '../utils/http.ts'
import { sanitizeUser as defaultSanitizeUser } from '../utils/sanitize.ts'
import { ensureSessionAfterLogin } from './sessionLifecycle.ts'
import {
	credentialDescriptorFromRecord,
	encodeCredential,
	loginOptionsRequestSchema,
	loginVerifyRequestSchema,
	registerVerifyRequestSchema,
	toAuthenticatorTransports,
	toChallengeRecord,
	toCredentialRecord,
	toUint8Array
} from './webauthnUtils.ts'

export type WebAuthnRegisterOptionsHandlerConfig = {
	webauthnAdapter: Pick<WebAuthnAdapter, 'listCredentials' | 'createChallenge'>
	rpName: string
	rpID: string
	timeout?: number
	attestationType?: GenerateRegistrationOptionsOpts['attestationType']
	authenticatorSelection?: GenerateRegistrationOptionsOpts['authenticatorSelection']
	supportedAlgorithmIDs?: GenerateRegistrationOptionsOpts['supportedAlgorithmIDs']
	userVerification?: 'preferred' | 'required' | 'discouraged'
	getUser?: (event: RequestEventLike) => User | null | Promise<User | null>
}

/** Creates web authn register options handler for auth HTTP handlers. */
export function createWebAuthnRegisterOptionsHandler(
	config: WebAuthnRegisterOptionsHandlerConfig
): RequestHandler {
	const {
		webauthnAdapter,
		rpName,
		rpID,
		timeout = 60_000,
		attestationType = 'none',
		authenticatorSelection,
		supportedAlgorithmIDs,
		userVerification = 'preferred',
		getUser = (event: RequestEventLike) => event.locals.user ?? null
	} = config

	if (!rpID || !rpName) {
		throw new Error('createWebAuthnRegisterOptionsHandler requires rpID and rpName')
	}

	return async (event: RequestEventLike) => {
		const user = await getUser(event)
		if (!user || !user.id) {
			return jsonResponse({ ok: false, error: 'Unauthorized' }, 401)
		}

		const credentials = await webauthnAdapter.listCredentials(user.id)
		const excludeCredentials = credentials
			.map((cred) => credentialDescriptorFromRecord(cred))
			.filter(
				(
					cred
				): cred is {
					id: string
					transports?: AuthenticatorTransportFuture[]
				} => cred !== null
			)

		const optionsInput: GenerateRegistrationOptionsOpts = {
			rpID,
			rpName,
			userID: new TextEncoder().encode(String(user.id)),
			userName: user.email || String(user.id),
			userDisplayName: user.name || user.email || String(user.id),
			timeout,
			attestationType,
			excludeCredentials
		}
		optionsInput.authenticatorSelection = { ...authenticatorSelection, userVerification }
		if (supportedAlgorithmIDs) {
			optionsInput.supportedAlgorithmIDs = supportedAlgorithmIDs
		}
		const options = await generateRegistrationOptions(optionsInput)

		const challengeId = await generateRandomUUID()
		const expiresAt = new Date(Date.now() + timeout)
		await webauthnAdapter.createChallenge({
			challengeId,
			userId: user.id,
			challenge: options.challenge,
			type: 'registration',
			expiresAt
		})

		return jsonResponse({ options, challengeId })
	}
}

export type WebAuthnRegisterVerifyHandlerConfig = {
	webauthnAdapter: Pick<WebAuthnAdapter, 'consumeChallenge' | 'createCredential'>
	rpID: string
	origin: string
	requireUserVerification?: boolean
	onCredentialCreated?: (input: {
		userId: string
		credentialId: string
		publicKey: string
	}) => Promise<void> | void
}

/** Creates web authn register verify handler for auth HTTP handlers. */
export function createWebAuthnRegisterVerifyHandler(
	config: WebAuthnRegisterVerifyHandlerConfig
): RequestHandler {
	const {
		webauthnAdapter,
		rpID,
		origin,
		requireUserVerification = false,
		onCredentialCreated
	} = config

	if (!rpID || !origin) {
		throw new Error('createWebAuthnRegisterVerifyHandler requires rpID and origin')
	}

	return async (event: RequestEventLike) => {
		const data = await parseRequestDataWithSchema(event.request, registerVerifyRequestSchema)
		if (!data) {
			return jsonResponse({ ok: false, error: 'Invalid request' }, 400)
		}
		const { challengeId, credential, name } = data

		// Atomic consume — see WebAuthnLoginVerify for race-condition rationale.
		const challengeRaw = await webauthnAdapter.consumeChallenge(challengeId)
		const challenge = toChallengeRecord(challengeRaw)
		if (!challenge) {
			return jsonResponse({ ok: false, error: 'Challenge not found' }, 400)
		}
		if (challenge.type !== 'registration') {
			return jsonResponse({ ok: false, error: 'Invalid challenge' }, 400)
		}

		if (new Date(challenge.expiresAt) < new Date()) {
			// Already removed by consumeChallenge above.
			return jsonResponse({ ok: false, error: 'Challenge expired' }, 400)
		}

		const verification = await verifyRegistrationResponse({
			response: credential,
			expectedChallenge: challenge.challenge,
			expectedOrigin: origin,
			expectedRPID: rpID,
			requireUserVerification
		})

		if (!verification.verified || !verification.registrationInfo) {
			return jsonResponse({ ok: false, error: 'Registration failed' }, 400)
		}

		const registrationInfoRecord = verification.registrationInfo as Record<string, unknown>
		const regCredentialRecord = (
			typeof registrationInfoRecord['credential'] === 'object' &&
			registrationInfoRecord['credential'] !== null
				? registrationInfoRecord['credential']
				: registrationInfoRecord
		) as Record<string, unknown>
		const credentialIdRaw = regCredentialRecord['id'] ?? regCredentialRecord['credentialID']
		const publicKeyRaw =
			regCredentialRecord['publicKey'] ?? regCredentialRecord['credentialPublicKey']
		const counterRaw = regCredentialRecord['counter']
		const credentialId =
			typeof credentialIdRaw === 'string' ? credentialIdRaw : encodeCredential(credentialIdRaw)
		const publicKey = encodeCredential(publicKeyRaw)
		const counter = typeof counterRaw === 'number' ? counterRaw : 0
		const userId = challenge.userId
		if (!userId) {
			return jsonResponse({ ok: false, error: 'Challenge user missing' }, 400)
		}

		await webauthnAdapter.createCredential({
			userId,
			credentialId,
			publicKey,
			counter,
			transports:
				credential.response && 'transports' in credential.response
					? (credential.response.transports ?? null)
					: null,
			name: name ?? null
		})

		// Challenge was atomically consumed at the top of the handler.

		if (onCredentialCreated) {
			await onCredentialCreated({ userId, credentialId, publicKey })
		}

		return jsonResponse({ ok: true, credentialId })
	}
}

export type WebAuthnLoginOptionsHandlerConfig = {
	webauthnAdapter: Pick<WebAuthnAdapter, 'listCredentials' | 'createChallenge'>
	userAdapter?: { getUserByEmail: (email: string) => Promise<User | null> }
	rpID: string
	timeout?: number
	userVerification?: GenerateAuthenticationOptionsOpts['userVerification']
}

/** Creates web authn login options handler for auth HTTP handlers. */
export function createWebAuthnLoginOptionsHandler(
	config: WebAuthnLoginOptionsHandlerConfig
): RequestHandler {
	const {
		webauthnAdapter,
		userAdapter,
		rpID,
		timeout = 60_000,
		userVerification = 'preferred'
	} = config

	if (!rpID) {
		throw new Error('createWebAuthnLoginOptionsHandler requires rpID')
	}

	return async (event: RequestEventLike) => {
		const data = await parseRequestDataWithSchema(event.request, loginOptionsRequestSchema)
		const email = data?.email ? data.email.toLowerCase() : ''
		let user: User | null = null

		if (email && userAdapter) {
			user = await userAdapter.getUserByEmail(email)
		}

		let allowCredentials: GenerateAuthenticationOptionsOpts['allowCredentials'] | undefined
		if (user) {
			const credentials = await webauthnAdapter.listCredentials(user.id)
			allowCredentials = credentials
				.map((cred) => credentialDescriptorFromRecord(cred))
				.filter(
					(
						cred
					): cred is {
						id: string
						transports?: AuthenticatorTransportFuture[]
					} => cred !== null
				)
		}

		const optionsInput: GenerateAuthenticationOptionsOpts = {
			rpID,
			timeout,
			userVerification
		}
		if (allowCredentials) {
			optionsInput.allowCredentials = allowCredentials
		}
		const options = await generateAuthenticationOptions(optionsInput)

		const challengeId = await generateRandomUUID()
		const expiresAt = new Date(Date.now() + timeout)
		await webauthnAdapter.createChallenge({
			challengeId,
			userId: user?.id ?? null,
			challenge: options.challenge,
			type: 'authentication',
			expiresAt
		})

		return jsonResponse({ options, challengeId })
	}
}

export type WebAuthnLoginVerifyHandlerConfig = {
	webauthnAdapter: Pick<WebAuthnAdapter, 'consumeChallenge' | 'getCredential' | 'updateCredential'>
	userAdapter?: { getUserById: (id: string) => Promise<User | null> }
	sessionAdapter: Pick<SessionAdapter, 'createSession' | 'setSessionCookie'>
	rpID: string
	origin: string
	redirectAfterLogin?: string
	requireUserVerification?: boolean
	onLogin?: AuthHooks['onLogin']
	sanitizeUser?: (user: User | null) => User | null
	autoCreateSession?: boolean
	onLoginMode?: OnLoginMode
}

/** Creates web authn login verify handler for auth HTTP handlers. */
export function createWebAuthnLoginVerifyHandler(
	config: WebAuthnLoginVerifyHandlerConfig
): RequestHandler {
	const {
		webauthnAdapter,
		userAdapter,
		sessionAdapter,
		rpID,
		origin,
		redirectAfterLogin = '/',
		requireUserVerification = false,
		onLogin,
		sanitizeUser = defaultSanitizeUser,
		autoCreateSession = true,
		onLoginMode = 'augment'
	} = config

	if (!rpID || !origin) {
		throw new Error('createWebAuthnLoginVerifyHandler requires rpID and origin')
	}

	return async (event: RequestEventLike) => {
		const data = await parseRequestDataWithSchema(event.request, loginVerifyRequestSchema)
		if (!data) {
			return jsonResponse({ ok: false, error: 'Invalid request' }, 400)
		}
		const { challengeId, credential } = data

		// Atomically consume the challenge so two concurrent verifies of the
		// same challengeId cannot both succeed (in-tree adapters override
		// `consumeChallenge` with `DELETE ... RETURNING`).
		const challengeRaw = await webauthnAdapter.consumeChallenge(challengeId)
		const challenge = toChallengeRecord(challengeRaw)
		if (!challenge) {
			auditAuthEvent('webauthn.challenge_missing', { challengeId })
			return jsonResponse({ ok: false, error: 'Challenge not found' }, 400)
		}
		if (challenge.type !== 'authentication') {
			auditAuthEvent('webauthn.challenge_invalid_type', { challengeId })
			return jsonResponse({ ok: false, error: 'Invalid challenge' }, 400)
		}
		if (new Date(challenge.expiresAt) < new Date()) {
			// Already removed by consumeChallenge above.
			auditAuthEvent('webauthn.challenge_expired', { challengeId })
			return jsonResponse({ ok: false, error: 'Challenge expired' }, 400)
		}

		const storedCredentialRaw = await webauthnAdapter.getCredential(credential.id)
		const storedCredential = toCredentialRecord(storedCredentialRaw)
		if (!storedCredential) {
			auditAuthEvent('webauthn.credential_missing', {
				credentialId: credential.id
			})
			return jsonResponse({ ok: false, error: 'Credential not found' }, 400)
		}

		const credentialInput = {
			id: storedCredential.credentialId,
			publicKey: new Uint8Array(toUint8Array(storedCredential.publicKey)),
			counter: storedCredential.counter
		}
		const transports = toAuthenticatorTransports(storedCredential.transports)
		const verification = await verifyAuthenticationResponse({
			response: credential,
			expectedChallenge: challenge.challenge,
			expectedOrigin: origin,
			expectedRPID: rpID,
			credential: transports ? { ...credentialInput, transports } : credentialInput,
			requireUserVerification
		})

		if (!verification.verified) {
			auditAuthEvent('webauthn.authentication_failed', {
				credentialId: credential.id
			})
			return jsonResponse({ ok: false, error: 'Authentication failed' }, 400)
		}

		await webauthnAdapter.updateCredential(storedCredential.credentialId, {
			counter: verification.authenticationInfo.newCounter ?? storedCredential.counter
		})

		// Challenge was atomically consumed at the top of the handler.

		const user = userAdapter ? await userAdapter.getUserById(storedCredential.userId) : null
		let userId = storedCredential.userId
		if (!userId) {
			return jsonResponse({ ok: false, error: 'Unable to resolve authenticated principal' }, 401)
		}
		if (!user && !onLogin) {
			return jsonResponse({ ok: false, error: 'Unable to resolve authenticated principal' }, 401)
		}

		if (onLogin) {
			const profile = {
				id: userId,
				email: user?.email ?? '',
				...(user?.name ? { name: user.name } : {})
			}
			const hookResult = await onLogin(event, profile, null, user)
			if (hookResult?.userId) userId = String(hookResult.userId)
		}
		try {
			userId = await ensureSessionAfterLogin({
				event,
				sessionAdapter,
				userId,
				autoCreateSession,
				onLoginMode
			})
		} catch (error) {
			if (error instanceof AuthPrincipalResolutionError) {
				return jsonResponse({ ok: false, error: error.message }, error.status)
			}
			throw error
		}

		if (event.request.method === 'GET') {
			throw redirect(302, redirectAfterLogin)
		}

		return jsonResponse({ ok: true, user: sanitizeUser(user) })
	}
}
