import {
	type AuthenticatorTransportFuture,
	generateRegistrationOptions,
	type GenerateRegistrationOptionsOpts,
	verifyRegistrationResponse
} from '@simplewebauthn/server'
import {
	resolveWebAuthnCredentialLimit,
	type WebAuthnRegistrationAdapter
} from '../adapters/webauthn/WebAuthnAdapter.ts'
import { isValidCredentialCounter } from '../adapters/webauthn/_credentialCounter.ts'
import { emitRequestAuthEvent, type AuthEventEmitter } from '../security/events.ts'
import type {
	AuthRequestHandler,
	AuthorizeSecurityChange,
	RequestEventLike,
	WebAuthnCredentialLifecycleInput
} from '../types/auth.ts'
import type { User } from '../types/index.ts'
import { generateRandomUUID } from '../utils/crypto.ts'
import { jsonResponse, parseRequestDataWithSchema } from '../utils/http.ts'
import {
	credentialDescriptorFromRecord,
	encodeCredential,
	registerVerifyRequestSchema
} from './webauthnUtils.ts'

type RegistrationAdapter = Pick<
	WebAuthnRegistrationAdapter,
	| 'listCredentials'
	| 'createChallenge'
	| 'consumeChallenge'
	| 'createCredential'
	| 'createCredentialWithinLimit'
	| 'deleteCredential'
	| 'deleteExpiredChallenges'
>

export type WebAuthnRegisterOptionsHandlerConfig = {
	authorizeSecurityChange: AuthorizeSecurityChange
	webauthnAdapter: RegistrationAdapter
	rpName: string
	rpID: string
	timeout?: number
	attestationType?: GenerateRegistrationOptionsOpts['attestationType']
	authenticatorSelection?: Omit<
		NonNullable<GenerateRegistrationOptionsOpts['authenticatorSelection']>,
		'residentKey' | 'requireResidentKey' | 'userVerification'
	>
	supportedAlgorithmIDs?: GenerateRegistrationOptionsOpts['supportedAlgorithmIDs']
	maxCredentialsPerUser?: number
	getUser?: (event: RequestEventLike) => User | null | Promise<User | null>
}

export type WebAuthnRegisterVerifyHandlerConfig = {
	webauthnAdapter: RegistrationAdapter
	rpID: string
	origin: string
	maxCredentialsPerUser?: number
	getUser?: (event: RequestEventLike) => User | null | Promise<User | null>
	onCredentialCreated?: (input: WebAuthnCredentialLifecycleInput) => Promise<void> | void
	emitSecurityEvent?: AuthEventEmitter
}

/** Creates discoverable, user-verifying registration options for an authenticated principal. */
export function createWebAuthnRegisterOptionsHandler(
	config: WebAuthnRegisterOptionsHandlerConfig
): AuthRequestHandler {
	const {
		authorizeSecurityChange,
		webauthnAdapter,
		rpName,
		rpID,
		timeout = 60_000,
		attestationType = 'none',
		authenticatorSelection,
		supportedAlgorithmIDs,
		getUser = (event: RequestEventLike) => event.locals.user ?? null
	} = config
	const maxCredentialsPerUser = resolveWebAuthnCredentialLimit(config.maxCredentialsPerUser)

	if (!rpID || !rpName) {
		throw new Error('createWebAuthnRegisterOptionsHandler requires rpID and rpName')
	}

	return async (event: RequestEventLike) => {
		const user = await getUser(event)
		if (!user?.id) return jsonResponse({ ok: false, error: 'Unauthorized' }, 401)
		if (
			!(await authorizeSecurityChange({
				action: 'webauthn.register',
				request: event.request.clone(),
				userId: user.id,
				session: event.locals.session ?? null
			}))
		) {
			return jsonResponse({ ok: false, error: 'Reauthentication required' }, 403)
		}

		await webauthnAdapter.deleteExpiredChallenges(new Date())
		const credentials = await webauthnAdapter.listCredentials(user.id)
		if (credentials.length >= maxCredentialsPerUser) {
			return jsonResponse({ ok: false, error: 'Passkey limit reached' }, 409)
		}
		const excludeCredentials = credentials
			.map((credential) => credentialDescriptorFromRecord(credential))
			.filter(
				(
					credential
				): credential is {
					id: string
					transports?: AuthenticatorTransportFuture[]
				} => credential !== null
			)

		const optionsInput: GenerateRegistrationOptionsOpts = {
			rpID,
			rpName,
			userID: new TextEncoder().encode(String(user.id)),
			userName: user.email || String(user.id),
			userDisplayName: user.name || user.email || String(user.id),
			timeout,
			attestationType,
			excludeCredentials,
			authenticatorSelection: {
				...authenticatorSelection,
				residentKey: 'required',
				requireResidentKey: true,
				userVerification: 'required'
			}
		}
		if (supportedAlgorithmIDs) optionsInput.supportedAlgorithmIDs = supportedAlgorithmIDs
		const options = await generateRegistrationOptions(optionsInput)

		const challengeId = await generateRandomUUID()
		await webauthnAdapter.createChallenge({
			challengeId,
			userId: user.id,
			challenge: options.challenge,
			type: 'registration',
			expiresAt: new Date(Date.now() + timeout)
		})

		return jsonResponse({ options, challengeId })
	}
}

/** Verifies and persists a discoverable passkey for its challenge-bound owner. */
export function createWebAuthnRegisterVerifyHandler(
	config: WebAuthnRegisterVerifyHandlerConfig
): AuthRequestHandler {
	const {
		webauthnAdapter,
		rpID,
		origin,
		getUser = (event: RequestEventLike) => event.locals.user ?? null,
		onCredentialCreated,
		emitSecurityEvent
	} = config
	const maxCredentialsPerUser = resolveWebAuthnCredentialLimit(config.maxCredentialsPerUser)

	if (!rpID || !origin) {
		throw new Error('createWebAuthnRegisterVerifyHandler requires rpID and origin')
	}

	return async (event: RequestEventLike) => {
		const user = await getUser(event)
		if (!user?.id) return jsonResponse({ ok: false, error: 'Unauthorized' }, 401)
		const data = await parseRequestDataWithSchema(event.request, registerVerifyRequestSchema)
		if (!data) return jsonResponse({ ok: false, error: 'Invalid request' }, 400)
		if ((await webauthnAdapter.listCredentials(user.id)).length >= maxCredentialsPerUser) {
			return jsonResponse({ ok: false, error: 'Passkey limit reached' }, 409)
		}

		const challenge = await webauthnAdapter.consumeChallenge(data.challengeId)
		if (!challenge) return jsonResponse({ ok: false, error: 'Challenge not found' }, 400)
		if (challenge.type !== 'registration') {
			return jsonResponse({ ok: false, error: 'Invalid challenge' }, 400)
		}
		if (challenge.userId !== user.id) {
			return jsonResponse({ ok: false, error: 'Challenge principal mismatch' }, 403)
		}
		if (new Date(challenge.expiresAt).getTime() < Date.now()) {
			return jsonResponse({ ok: false, error: 'Challenge expired' }, 400)
		}

		const verification = await verifyRegistrationResponse({
			response: data.credential,
			expectedChallenge: challenge.challenge,
			expectedOrigin: origin,
			expectedRPID: rpID,
			requireUserVerification: true
		})
		if (!verification.verified || !verification.registrationInfo) {
			return jsonResponse({ ok: false, error: 'Registration failed' }, 400)
		}

		const registrationInfo = verification.registrationInfo as Record<string, unknown>
		const credentialRecord = (
			typeof registrationInfo['credential'] === 'object' && registrationInfo['credential'] !== null
				? registrationInfo['credential']
				: registrationInfo
		) as Record<string, unknown>
		const credentialIdRaw = credentialRecord['id'] ?? credentialRecord['credentialID']
		const publicKeyRaw = credentialRecord['publicKey'] ?? credentialRecord['credentialPublicKey']
		const counter = credentialRecord['counter'] ?? 0
		const credentialId =
			typeof credentialIdRaw === 'string' ? credentialIdRaw : encodeCredential(credentialIdRaw)
		const publicKey = encodeCredential(publicKeyRaw)
		if (!credentialId || !publicKey || !isValidCredentialCounter(counter)) {
			return jsonResponse({ ok: false, error: 'Invalid credential' }, 400)
		}

		const creation = await webauthnAdapter.createCredentialWithinLimit({
			userId: user.id,
			credentialId,
			publicKey,
			counter,
			maxCredentialsPerUser,
			transports:
				data.credential.response && 'transports' in data.credential.response
					? (data.credential.response.transports ?? null)
					: null,
			name: data.name ?? null
		})
		switch (creation) {
			case 'created':
				break
			case 'limit-reached':
				return jsonResponse({ ok: false, error: 'Passkey limit reached' }, 409)
			case 'owner-unavailable':
				return jsonResponse({ ok: false, error: 'Credential owner is unavailable' }, 403)
			case 'duplicate':
				return jsonResponse({ ok: false, error: 'Credential is already registered' }, 409)
			default:
				throw new TypeError('WebAuthn adapter returned an invalid credential creation outcome')
		}

		try {
			await onCredentialCreated?.({ userId: user.id, credentialId, event })
		} catch (lifecycleError) {
			try {
				await webauthnAdapter.deleteCredential({ userId: user.id, credentialId })
			} catch (rollbackError) {
				throw new AggregateError(
					[lifecycleError, rollbackError],
					'WebAuthn credential lifecycle and rollback both failed'
				)
			}
			throw lifecycleError
		}
		await emitRequestAuthEvent(emitSecurityEvent, event, {
			name: 'webauthn.credential_registered',
			severity: 'info',
			status: 200
		})
		return jsonResponse({ ok: true, credentialId })
	}
}
