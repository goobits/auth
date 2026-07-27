import type { RequestEventLike } from '../types/auth.ts'
import type { Session, SessionMetadata } from '../types/core.ts'

export type AssuredSessionAdapter = {
	createSession: (userId: string, metadata?: SessionMetadata) => Promise<Session>
	invalidateSession: (sessionId: string) => Promise<void>
	setSessionCookie: (cookies: RequestEventLike['cookies'], session: Session) => void
}

/** Rotates a session after a verified phishing-resistant or one-time-code factor. */
export async function rotateAssuredSession({
	sessionAdapter,
	cookies,
	currentSession,
	userId,
	mfaVerifiedAt = new Date()
}: {
	sessionAdapter: AssuredSessionAdapter
	cookies: RequestEventLike['cookies']
	currentSession: Session
	userId: string
	mfaVerifiedAt?: Date
}): Promise<Session> {
	const primaryAuthentication =
		currentSession.createdAt instanceof Date && !Number.isNaN(currentSession.createdAt.getTime())
			? currentSession.createdAt
			: new Date(0)
	const metadata: SessionMetadata = {
		createdAt: primaryAuthentication,
		mfaVerifiedAt,
		...(currentSession.ip ? { ip: currentSession.ip } : {}),
		...(currentSession.userAgent ? { userAgent: currentSession.userAgent } : {}),
		...(currentSession.fingerprint ? { fingerprint: currentSession.fingerprint } : {})
	}
	const replacement = await sessionAdapter.createSession(userId, metadata)
	try {
		await sessionAdapter.invalidateSession(currentSession.id)
	} catch (error) {
		await sessionAdapter.invalidateSession(replacement.id).catch(() => undefined)
		throw error
	}
	sessionAdapter.setSessionCookie(cookies, replacement)
	return replacement
}
