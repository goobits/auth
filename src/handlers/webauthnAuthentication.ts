import {
	type AuthenticatorTransportFuture,
	generateAuthenticationOptions
} from '@simplewebauthn/server'
import { redirect } from '@sveltejs/kit'

import type { SessionAdapter } from '../adapters/session/SessionAdapter.ts'
import type { WebAuthnAdapter } from '../adapters/webauthn/WebAuthnAdapter.ts'
import { AuthPrincipalResolutionError } from '../errors/AuthPrincipalResolutionError.ts'
import type {
	AuthHooks,
	AuthRequestHandler,
	OnLoginMode,
	RequestEventLike
} from '../types/auth.ts'
import type { User } from '../types/index.ts'
import { generateRandomUUID } from '../utils/crypto.ts'
import { jsonResponse } from '../utils/http.ts'
import { sanitizeUser as defaultSanitizeUser } from '../utils/sanitize.ts'
import { type AssuredSessionAdapter, rotateAssuredSession } from './_assuredSession.ts'
import {
	type WebAuthnVerificationConfig,
	verifyWebAuthnCredential
} from './_webauthnVerification.ts'
import { ensureSessionAfterLogin } from './sessionLifecycle.ts'
import { credentialDescriptorFromRecord } from './webauthnUtils.ts'

export type WebAuthnLoginOptionsHandlerConfig = {
	webauthnAdapter: Pick<WebAuthnAdapter, 'createChallenge' | 'deleteExpiredChallenges'>
	rpID: string
	timeout?: number
}

export type WebAuthnLoginVerifyHandlerConfig = WebAuthnVerificationConfig & {
	userAdapter?: { getUserById: (id: string) => Promise<User | null> }
	sessionAdapter: Pick<SessionAdapter, 'createSession' | 'setSessionCookie'>
	getSessionMetadata?: AuthHooks['getSessionMetadata']
	redirectAfterLogin?: string
	onLogin?: AuthHooks['onLogin']
	sanitizeUser?: (user: User | null) => User | null
	autoCreateSession?: boolean
	onLoginMode?: OnLoginMode
}

export type WebAuthnStepUpOptionsHandlerConfig = {
	webauthnAdapter: Pick<
		WebAuthnAdapter,
		'createChallenge' | 'deleteExpiredChallenges' | 'listCredentials'
	>
	rpID: string
	timeout?: number
	getUser?: (event: RequestEventLike) => User | null | Promise<User | null>
}

export type WebAuthnStepUpVerifyHandlerConfig = WebAuthnVerificationConfig & {
	sessionAdapter: AssuredSessionAdapter
	getUser?: (event: RequestEventLike) => User | null | Promise<User | null>
}

/** Creates an identifierless passkey challenge without account-dependent output. */
export function createWebAuthnLoginOptionsHandler(
	config: WebAuthnLoginOptionsHandlerConfig
): AuthRequestHandler {
	const { webauthnAdapter, rpID, timeout = 60_000 } = config
	if (!rpID) throw new Error('createWebAuthnLoginOptionsHandler requires rpID')

	return async () => {
		await webauthnAdapter.deleteExpiredChallenges(new Date())
		const options = await generateAuthenticationOptions({
			rpID,
			timeout,
			userVerification: 'required'
		})
		const challengeId = await generateRandomUUID()
		await webauthnAdapter.createChallenge({
			challengeId,
			userId: null,
			challenge: options.challenge,
			type: 'authentication',
			expiresAt: new Date(Date.now() + timeout)
		})
		return jsonResponse({ options, challengeId })
	}
}

/** Verifies an identifierless passkey and creates an MFA-assured login session. */
export function createWebAuthnLoginVerifyHandler(
	config: WebAuthnLoginVerifyHandlerConfig
): AuthRequestHandler {
	const {
		userAdapter,
		sessionAdapter,
		getSessionMetadata,
		redirectAfterLogin = '/',
		onLogin,
		sanitizeUser = defaultSanitizeUser,
		autoCreateSession = true,
		onLoginMode = 'augment'
	} = config
	if (!config.rpID || !config.origin) {
		throw new Error('createWebAuthnLoginVerifyHandler requires rpID and origin')
	}

	return async (event: RequestEventLike) => {
		const result = await verifyWebAuthnCredential(event, config, 'authentication', null)
		if (!result.verified) return result.response

		const user = userAdapter ? await userAdapter.getUserById(result.credential.userId) : null
		if (!user && !onLogin) {
			return jsonResponse({ ok: false, error: 'Unable to resolve authenticated principal' }, 401)
		}
		let userId = result.credential.userId
		if (onLogin) {
			const hookResult = await onLogin(
				event,
				{
					id: userId,
					email: user?.email ?? '',
					...(user?.name ? { name: user.name } : {})
				},
				null,
				user
			)
			if (hookResult?.userId && String(hookResult.userId) !== userId) {
				return jsonResponse({ ok: false, error: 'Unable to resolve authenticated principal' }, 401)
			}
		}

		try {
			userId = await ensureSessionAfterLogin({
				event,
				sessionAdapter,
				userId,
				...(getSessionMetadata ? { getSessionMetadata } : {}),
				sessionMetadata: { mfaVerifiedAt: new Date() },
				autoCreateSession,
				onLoginMode
			})
		} catch (error) {
			if (error instanceof AuthPrincipalResolutionError) {
				return jsonResponse({ ok: false, error: error.message }, error.status)
			}
			throw error
		}
		if (event.request.method === 'GET') throw redirect(302, redirectAfterLogin)
		return jsonResponse({ ok: true, user: sanitizeUser(user) })
	}
}

/** Creates a user-bound passkey challenge for an authenticated step-up. */
export function createWebAuthnStepUpOptionsHandler(
	config: WebAuthnStepUpOptionsHandlerConfig
): AuthRequestHandler {
	const {
		webauthnAdapter,
		rpID,
		timeout = 60_000,
		getUser = (event: RequestEventLike) => event.locals.user ?? null
	} = config
	if (!rpID) throw new Error('createWebAuthnStepUpOptionsHandler requires rpID')

	return async (event: RequestEventLike) => {
		const user = await getUser(event)
		const session = event.locals.session
		if (!user?.id || !session || session.userId !== user.id) {
			return jsonResponse({ ok: false, error: 'Unauthorized' }, 401)
		}
		await webauthnAdapter.deleteExpiredChallenges(new Date())
		const allowCredentials = (await webauthnAdapter.listCredentials(user.id))
			.map((credential) => credentialDescriptorFromRecord(credential))
			.filter(
				(
					credential
				): credential is {
					id: string
					transports?: AuthenticatorTransportFuture[]
				} => credential !== null
			)
		if (allowCredentials.length === 0) {
			return jsonResponse({ ok: false, error: 'No passkeys registered' }, 409)
		}
		const options = await generateAuthenticationOptions({
			rpID,
			timeout,
			userVerification: 'required',
			allowCredentials
		})
		const challengeId = await generateRandomUUID()
		await webauthnAdapter.createChallenge({
			challengeId,
			userId: user.id,
			challenge: options.challenge,
			type: 'step-up',
			expiresAt: new Date(Date.now() + timeout)
		})
		return jsonResponse({ options, challengeId })
	}
}

/** Verifies a user-bound passkey and rotates the current session with fresh assurance. */
export function createWebAuthnStepUpVerifyHandler(
	config: WebAuthnStepUpVerifyHandlerConfig
): AuthRequestHandler {
	const { sessionAdapter, getUser = (event: RequestEventLike) => event.locals.user ?? null } =
		config
	if (!config.rpID || !config.origin) {
		throw new Error('createWebAuthnStepUpVerifyHandler requires rpID and origin')
	}

	return async (event: RequestEventLike) => {
		const user = await getUser(event)
		const currentSession = event.locals.session
		if (!user?.id || !currentSession || currentSession.userId !== user.id) {
			return jsonResponse({ ok: false, error: 'Unauthorized' }, 401)
		}
		const result = await verifyWebAuthnCredential(event, config, 'step-up', user.id)
		if (!result.verified) return result.response
		const replacement = await rotateAssuredSession({
			sessionAdapter,
			cookies: event.cookies,
			currentSession,
			userId: user.id
		})
		return jsonResponse({
			ok: true,
			mfaVerifiedAt: replacement.mfaVerifiedAt?.toISOString()
		})
	}
}
