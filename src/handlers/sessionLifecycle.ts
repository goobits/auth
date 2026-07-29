import type { SessionAdapter } from '../adapters/session/SessionAdapter.ts'
import { AuthPrincipalResolutionError } from '../errors/AuthPrincipalResolutionError.ts'
import type { AuthHooks, OnLoginMode, RequestEventLike } from '../types/auth.ts'
import type { SessionMetadata } from '../types/core.ts'

type SessionLoginAdapter = Pick<SessionAdapter, 'createSession'> &
	Partial<Pick<SessionAdapter, 'setSessionCookie'>>

export async function ensureSessionAfterLogin(input: {
	event: RequestEventLike
	sessionAdapter: SessionLoginAdapter
	userId: string | null
	getSessionMetadata?: AuthHooks['getSessionMetadata']
	sessionMetadata?: SessionMetadata
	autoCreateSession?: boolean
	onLoginMode?: OnLoginMode
}): Promise<string> {
	const {
		event,
		sessionAdapter,
		userId,
		getSessionMetadata,
		sessionMetadata,
		autoCreateSession = true,
		onLoginMode = 'augment'
	} = input

	if (!userId) {
		throw new AuthPrincipalResolutionError()
	}

	if (autoCreateSession && onLoginMode === 'augment') {
		const hasSessionMetadata = Boolean(getSessionMetadata || sessionMetadata)
		const resolvedMetadata: SessionMetadata = getSessionMetadata
			? { ...(await getSessionMetadata(event, userId)) }
			: {}
		// Initial-login assurance and primary-authentication timestamps belong to
		// the verified protocol handler, never an application metadata callback.
		delete resolvedMetadata.createdAt
		delete resolvedMetadata.mfaVerifiedAt
		Object.assign(resolvedMetadata, sessionMetadata)
		const session = hasSessionMetadata
			? await sessionAdapter.createSession(userId, resolvedMetadata)
			: await sessionAdapter.createSession(userId)
		sessionAdapter.setSessionCookie?.(event.cookies, session)
	}

	return userId
}
