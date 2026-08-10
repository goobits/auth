import type { RequestEventLike } from '../types/auth.ts'
import type { AuthSession, SessionMetadata } from '../types/core.ts'

export type AssuredSessionAdapter = {
	createSession: (userId: string, metadata?: SessionMetadata) => Promise<AuthSession>
	invalidateSession: (sessionId: string) => Promise<void>
	setSessionCookie: (cookies: RequestEventLike['cookies'], session: AuthSession) => void
}

export type SessionAssuranceKind = 'primary' | 'mfa'

function validTimestamp(value: unknown): Date | null {
	return value instanceof Date && !Number.isNaN(value.getTime()) ? value : null
}

/** Rotates a session after a trusted primary- or second-factor verification. */
export async function rotateSessionAssurance({
	sessionAdapter,
	assurance,
	cookies,
	currentSession,
	userId,
	verifiedAt = new Date()
}: {
	sessionAdapter: AssuredSessionAdapter
	assurance: SessionAssuranceKind
	cookies: RequestEventLike['cookies']
	currentSession: AuthSession
	userId: string
	verifiedAt?: Date
}): Promise<AuthSession> {
	if (currentSession.userId !== userId) {
		throw new Error('@goobits/auth: session assurance principal mismatch')
	}
	if (assurance !== 'primary' && assurance !== 'mfa') {
		throw new Error('@goobits/auth: invalid session assurance kind')
	}
	const authenticationTime = validTimestamp(verifiedAt)
	if (!authenticationTime) {
		throw new Error('@goobits/auth: invalid session assurance timestamp')
	}
	const currentPrimaryAuthentication = validTimestamp(currentSession.createdAt)
	const currentMfaVerification = validTimestamp(currentSession.mfaVerifiedAt)
	const metadata: SessionMetadata = {
		createdAt:
			assurance === 'primary' ? authenticationTime : (currentPrimaryAuthentication ?? new Date(0)),
		...(assurance === 'mfa'
			? { mfaVerifiedAt: authenticationTime }
			: currentMfaVerification
				? { mfaVerifiedAt: currentMfaVerification }
				: {}),
		...(typeof currentSession.rememberMe === 'boolean'
			? { rememberMe: currentSession.rememberMe }
			: {}),
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
