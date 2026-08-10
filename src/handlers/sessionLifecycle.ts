import type { SessionAdapter } from '../adapters/session/SessionAdapter.ts'
import { AuthPrincipalResolutionError } from '../errors/AuthPrincipalResolutionError.ts'
import type { AuthHooks, OnLoginMode, RequestEventLike } from '../types/auth.ts'
import type { SessionMetadata, User } from '../types/core.ts'
import { isSafeRedirectPath } from '../utils/redirect.ts'
import {
	beginMfaLoginChallenge,
	type MfaLoginChallengeResponse,
	type MfaLoginConfig
} from './mfa.ts'

type SessionLoginAdapter = Pick<SessionAdapter, 'createSession'> &
	Partial<Pick<SessionAdapter, 'setSessionCookie'>>

export type SessionLoginResult =
	| { status: 'authenticated'; userId: string }
	| {
			status: 'mfa-required' | 'mfa-enrollment-required'
			userId: string
			redirectTo: string
			response: MfaLoginChallengeResponse
	  }

export async function ensureSessionAfterLogin(input: {
	event: RequestEventLike
	sessionAdapter: SessionLoginAdapter
	userId: string | null
	getSessionMetadata?: AuthHooks['getSessionMetadata']
	sessionMetadata?: SessionMetadata
	user?: User | null
	mfa?: MfaLoginConfig
	redirectTo?: string
	beforeSessionCreate?: () => Promise<void> | void
	autoCreateSession?: boolean
	onLoginMode?: OnLoginMode
}): Promise<SessionLoginResult> {
	const {
		event,
		sessionAdapter,
		userId,
		getSessionMetadata,
		sessionMetadata,
		user,
		mfa,
		redirectTo,
		beforeSessionCreate,
		autoCreateSession = true,
		onLoginMode = 'augment'
	} = input

	if (!userId) {
		throw new AuthPrincipalResolutionError()
	}
	const needsSessionMetadata = Boolean(mfa || (autoCreateSession && onLoginMode === 'augment'))
	const hasSessionMetadata = Boolean(getSessionMetadata || sessionMetadata)
	const resolvedMetadata: SessionMetadata =
		needsSessionMetadata && getSessionMetadata
			? { ...(await getSessionMetadata(event, userId)) }
			: {}
	if (needsSessionMetadata) {
		// Initial-login assurance and primary-authentication timestamps belong to
		// the verified protocol handler, never an application metadata callback.
		delete resolvedMetadata.createdAt
		delete resolvedMetadata.mfaVerifiedAt
		Object.assign(resolvedMetadata, sessionMetadata)
	}
	if (mfa) {
		if (!user || String(user.id) !== userId) throw new AuthPrincipalResolutionError()
		const challenge = await beginMfaLoginChallenge({
			event,
			user,
			sessionMetadata: resolvedMetadata,
			...(redirectTo ? { redirectTo } : {}),
			config: mfa
		})
		if (challenge.handled) {
			const enrollmentRequired = challenge.response.mfaEnrollmentRequired === true
			const pendingRedirect = enrollmentRequired
				? (mfa.enrollmentRedirect ?? mfa.challengeRedirect ?? '/')
				: (mfa.challengeRedirect ?? '/')
			return {
				status: enrollmentRequired ? 'mfa-enrollment-required' : 'mfa-required',
				userId,
				redirectTo: isSafeRedirectPath(pendingRedirect) ? pendingRedirect : '/',
				response: challenge.response
			}
		}
	}

	if (autoCreateSession && onLoginMode === 'augment') {
		await beforeSessionCreate?.()
		const session = hasSessionMetadata
			? await sessionAdapter.createSession(userId, resolvedMetadata)
			: await sessionAdapter.createSession(userId)
		sessionAdapter.setSessionCookie?.(event.cookies, session)
	}

	return { status: 'authenticated', userId }
}
