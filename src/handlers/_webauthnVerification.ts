import { verifyAuthenticationResponse } from '@simplewebauthn/server'

import type { WebAuthnAdapter } from '../adapters/webauthn/WebAuthnAdapter.ts'
import { assertCredentialCounterTransition } from '../adapters/webauthn/_credentialCounter.ts'
import { emitRequestAuthEvent, type AuthEventEmitter } from '../security/events.ts'
import type { RequestEventLike } from '../types/auth.ts'
import { jsonResponse, parseRequestDataWithSchema } from '../utils/http.ts'
import {
	encodeCredential,
	loginVerifyRequestSchema,
	toAuthenticatorTransports,
	toChallengeRecord,
	toCredentialRecord,
	toUint8Array
} from './webauthnUtils.ts'

type AuthenticationAdapter = Pick<
	WebAuthnAdapter,
	'consumeChallenge' | 'getCredential' | 'advanceCredentialCounter'
>

export type WebAuthnVerificationConfig = {
	webauthnAdapter: AuthenticationAdapter
	rpID: string
	origin: string
	emitSecurityEvent?: AuthEventEmitter
}

type AuthenticationPurpose = 'authentication' | 'step-up'

type CredentialVerificationResult =
	| { verified: true; credential: { userId: string } }
	| { verified: false; response: Response }

async function authenticationFailure(
	emitter: AuthEventEmitter | undefined,
	event: RequestEventLike,
	status: number,
	error: string,
	reason: string
): Promise<CredentialVerificationResult> {
	await emitRequestAuthEvent(emitter, event, {
		name: 'webauthn.authentication_failed',
		severity: 'warn',
		status,
		details: { reason }
	})
	return { verified: false, response: jsonResponse({ ok: false, error }, status) }
}

/** Atomically consumes and verifies a passkey assertion for its declared purpose and owner. */
export async function verifyWebAuthnCredential(
	event: RequestEventLike,
	config: WebAuthnVerificationConfig,
	purpose: AuthenticationPurpose,
	expectedUserId: string | null
): Promise<CredentialVerificationResult> {
	const data = await parseRequestDataWithSchema(event.request, loginVerifyRequestSchema)
	if (!data) {
		return authenticationFailure(
			config.emitSecurityEvent,
			event,
			400,
			'Invalid request',
			'invalid-request'
		)
	}

	const challenge = toChallengeRecord(
		await config.webauthnAdapter.consumeChallenge(data.challengeId)
	)
	if (!challenge) {
		await emitRequestAuthEvent(config.emitSecurityEvent, event, {
			name: 'webauthn.challenge_missing',
			severity: 'warn',
			status: 400
		})
		return {
			verified: false,
			response: jsonResponse({ ok: false, error: 'Challenge not found' }, 400)
		}
	}
	if (challenge.type !== purpose) {
		await emitRequestAuthEvent(config.emitSecurityEvent, event, {
			name: 'webauthn.challenge_invalid_type',
			severity: 'warn',
			status: 400
		})
		return {
			verified: false,
			response: jsonResponse({ ok: false, error: 'Invalid challenge' }, 400)
		}
	}
	if (challenge.userId !== expectedUserId) {
		return authenticationFailure(
			config.emitSecurityEvent,
			event,
			403,
			'Challenge principal mismatch',
			'challenge-principal-mismatch'
		)
	}
	if (new Date(challenge.expiresAt).getTime() < Date.now()) {
		await emitRequestAuthEvent(config.emitSecurityEvent, event, {
			name: 'webauthn.challenge_expired',
			severity: 'warn',
			status: 400
		})
		return {
			verified: false,
			response: jsonResponse({ ok: false, error: 'Challenge expired' }, 400)
		}
	}

	const storedCredential = toCredentialRecord(
		await config.webauthnAdapter.getCredential(data.credential.id)
	)
	if (!storedCredential) {
		await emitRequestAuthEvent(config.emitSecurityEvent, event, {
			name: 'webauthn.credential_missing',
			severity: 'warn',
			status: 400
		})
		return {
			verified: false,
			response: jsonResponse({ ok: false, error: 'Credential not found' }, 400)
		}
	}
	if (expectedUserId !== null && storedCredential.userId !== expectedUserId) {
		return authenticationFailure(
			config.emitSecurityEvent,
			event,
			403,
			'Credential principal mismatch',
			'credential-principal-mismatch'
		)
	}
	const userHandle = data.credential.response.userHandle
	if (
		userHandle &&
		userHandle !== encodeCredential(new TextEncoder().encode(storedCredential.userId))
	) {
		return authenticationFailure(
			config.emitSecurityEvent,
			event,
			403,
			'Credential principal mismatch',
			'user-handle-mismatch'
		)
	}

	const credential = {
		id: storedCredential.credentialId,
		publicKey: new Uint8Array(toUint8Array(storedCredential.publicKey)),
		counter: storedCredential.counter
	}
	const transports = toAuthenticatorTransports(storedCredential.transports)
	const verification = await verifyAuthenticationResponse({
		response: data.credential,
		expectedChallenge: challenge.challenge,
		expectedOrigin: config.origin,
		expectedRPID: config.rpID,
		credential: transports ? { ...credential, transports } : credential,
		requireUserVerification: true
	})
	if (!verification.verified) {
		return authenticationFailure(
			config.emitSecurityEvent,
			event,
			400,
			'Authentication failed',
			'assertion-invalid'
		)
	}

	const newCounter = verification.authenticationInfo.newCounter
	try {
		assertCredentialCounterTransition(storedCredential.counter, newCounter)
	} catch {
		return authenticationFailure(
			config.emitSecurityEvent,
			event,
			409,
			'Credential counter validation failed',
			'credential-counter-regression'
		)
	}
	if (
		!(await config.webauthnAdapter.advanceCredentialCounter({
			credentialId: storedCredential.credentialId,
			userId: storedCredential.userId,
			expectedCounter: storedCredential.counter,
			newCounter
		}))
	) {
		return authenticationFailure(
			config.emitSecurityEvent,
			event,
			409,
			'Credential state changed; try again',
			'credential-counter-conflict'
		)
	}

	await emitRequestAuthEvent(config.emitSecurityEvent, event, {
		name: 'webauthn.authentication_succeeded',
		severity: 'info',
		status: 200,
		details: { purpose }
	})
	return { verified: true, credential: { userId: storedCredential.userId } }
}
