import type { SessionAdapter } from '../adapters/session/SessionAdapter.js'
import { AuthPrincipalResolutionError } from '../errors/AuthPrincipalResolutionError.js'
import type { OnLoginMode, RequestEventLike } from '../types/auth.js'

type SessionLoginAdapter = Pick<SessionAdapter, 'createSession'> &
	Partial<Pick<SessionAdapter, 'setSessionCookie'>>

export async function ensureSessionAfterLogin(input: {
	event: RequestEventLike;
	sessionAdapter: SessionLoginAdapter;
	userId: string | null;
	autoCreateSession?: boolean;
	onLoginMode?: OnLoginMode;
}): Promise<string> {
	const {
		event,
		sessionAdapter,
		userId,
		autoCreateSession = true,
		onLoginMode = 'augment'
	} = input

	if (!userId) {
		throw new AuthPrincipalResolutionError()
	}

	if (autoCreateSession && onLoginMode === 'augment') {
		const session = await sessionAdapter.createSession(userId)
		sessionAdapter.setSessionCookie?.(event.cookies, session)
	}

	return userId
}
