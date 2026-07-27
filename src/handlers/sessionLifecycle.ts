import type { SessionAdapter } from '../adapters/session/SessionAdapter.ts'
import { AuthPrincipalResolutionError } from '../errors/AuthPrincipalResolutionError.ts'
import type { OnLoginMode, RequestEventLike } from '../types/auth.ts'
import type { SessionMetadata } from '../types/core.ts'

type SessionLoginAdapter = Pick<SessionAdapter, 'createSession'> &
	Partial<Pick<SessionAdapter, 'setSessionCookie'>>

export async function ensureSessionAfterLogin(input: {
	event: RequestEventLike
	sessionAdapter: SessionLoginAdapter
	userId: string | null
	sessionMetadata?: SessionMetadata
	autoCreateSession?: boolean
	onLoginMode?: OnLoginMode
}): Promise<string> {
	const {
		event,
		sessionAdapter,
		userId,
		sessionMetadata,
		autoCreateSession = true,
		onLoginMode = 'augment'
	} = input

	if (!userId) {
		throw new AuthPrincipalResolutionError()
	}

	if (autoCreateSession && onLoginMode === 'augment') {
		const session = sessionMetadata
			? await sessionAdapter.createSession(userId, sessionMetadata)
			: await sessionAdapter.createSession(userId)
		sessionAdapter.setSessionCookie?.(event.cookies, session)
	}

	return userId
}
