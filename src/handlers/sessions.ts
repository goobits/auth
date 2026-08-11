import type { SessionAdapter } from '../adapters/session/SessionAdapter.ts'
import { AuthAdapterCapabilityError } from '../errors/AuthPrincipalResolutionError.ts'
import type { AuthLocals, RequestEventLike } from '../types/auth.ts'
import type { AuthSession, SessionSummary, User } from '../types/index.ts'
import { jsonResponse, parseRequestData } from '../utils/http.ts'

type SessionManagementAdapter = Partial<
	Pick<
		SessionAdapter,
		| 'listManagedSessions'
		| 'revokeManagedSession'
		| 'invalidateUserSessions'
		| 'deleteSessionCookie'
	>
>

type SessionHandlerConfig = {
	sessionAdapter: SessionManagementAdapter
	isAuthenticated?: (locals: AuthLocals) => boolean
	getUser?: (locals: AuthLocals) => { id: string }
	getSession?: (locals: AuthLocals) => AuthSession | null
}

const toSafeSessionSummary = (session: SessionSummary, currentManagementId?: string) => ({
	id: session.id,
	userId: session.userId,
	expiresAt: session.expiresAt,
	createdAt: session.createdAt ?? null,
	lastActiveAt: session.lastActiveAt ?? null,
	ip: session.ip ?? null,
	userAgent: session.userAgent ?? null,
	current: currentManagementId === session.id
})

const noStore = (response: Response) => {
	response.headers.set('cache-control', 'no-store')
	return response
}

/** Returns the sanitized current principal without exposing the bearer session id. */
export function createCurrentSessionHandler(
	config: {
		isAuthenticated?: (locals: AuthLocals) => boolean
		sanitizeUser?: (user: User | null) => User | null
	} = {}
) {
	const {
		isAuthenticated = (locals: AuthLocals) => !!locals.user && !!locals.session,
		sanitizeUser = (user: User | null) => user
	} = config

	return async (event: RequestEventLike) => {
		const user = event.locals.user ?? null
		const session = event.locals.session ?? null
		if (!isAuthenticated(event.locals) || !user || !session) {
			return noStore(new Response(null, { status: 204 }))
		}

		const safeUser = sanitizeUser(user)
		if (!safeUser) return noStore(new Response(null, { status: 204 }))

		return noStore(
			jsonResponse({
				success: true,
				user: safeUser,
				session: {
					userId: session.userId,
					expiresAt: session.expiresAt,
					createdAt: session.createdAt ?? null,
					lastActiveAt: session.lastActiveAt ?? null,
					mfaVerifiedAt: session.mfaVerifiedAt ?? null,
					rememberMe: session.rememberMe ?? false
				}
			})
		)
	}
}

const isUnsupportedError = (error: unknown): boolean =>
	error instanceof AuthAdapterCapabilityError ||
	(error instanceof Error &&
		(error.message.includes('not support') || error.message.includes('not implemented')))

/** Creates session list handler for auth HTTP handlers. */
export function createSessionListHandler(config: SessionHandlerConfig) {
	const {
		sessionAdapter,
		isAuthenticated = (locals: AuthLocals) => !!locals.user,
		getUser = (locals: AuthLocals) => locals.user as { id: string },
		getSession = (locals: AuthLocals) => locals.session ?? null
	} = config

	if (!sessionAdapter) {
		throw new Error('createSessionListHandler requires sessionAdapter')
	}

	return async (event: RequestEventLike) => {
		if (!isAuthenticated(event.locals)) {
			return jsonResponse({ ok: false, error: 'Unauthorized' }, 401)
		}

		if (typeof sessionAdapter.listManagedSessions !== 'function') {
			return jsonResponse({ ok: false, error: 'Session listing not supported' }, 501)
		}

		const user = getUser(event.locals)
		const current = getSession(event.locals)
		let sessions: SessionSummary[]
		try {
			sessions = await sessionAdapter.listManagedSessions(user.id)
		} catch (error) {
			if (isUnsupportedError(error)) {
				return jsonResponse({ ok: false, error: 'Session listing not supported' }, 501)
			}
			return jsonResponse({ ok: false, error: 'Failed to list sessions' }, 500)
		}
		const currentManagementId = current?.managementId
		const normalized = sessions.map((session) => toSafeSessionSummary(session, currentManagementId))

		return jsonResponse({ ok: true, sessions: normalized })
	}
}

/** Creates session revoke handler for auth HTTP handlers. */
export function createSessionRevokeHandler(config: SessionHandlerConfig) {
	const {
		sessionAdapter,
		isAuthenticated = (locals: AuthLocals) => !!locals.user,
		getUser = (locals: AuthLocals) => locals.user as { id: string },
		getSession = (locals: AuthLocals) => locals.session ?? null
	} = config

	if (!sessionAdapter) {
		throw new Error('createSessionRevokeHandler requires sessionAdapter')
	}

	return async (event: RequestEventLike) => {
		if (!isAuthenticated(event.locals)) {
			return jsonResponse({ ok: false, error: 'Unauthorized' }, 401)
		}

		const data = await parseRequestData(event.request)
		const user = getUser(event.locals)
		const current = getSession(event.locals)
		const currentManagementId = current?.managementId

		const sessionId =
			typeof data['sessionId'] === 'string'
				? data['sessionId']
				: typeof data['id'] === 'string'
					? data['id']
					: ''
		const revokeAll = data['all'] === true || data['all'] === 'true' || data['all'] === 1
		const revokeOthers =
			data['others'] === true || data['others'] === 'true' || data['others'] === 1

		if (sessionId) {
			if (
				typeof sessionAdapter.listManagedSessions !== 'function' ||
				typeof sessionAdapter.revokeManagedSession !== 'function'
			) {
				return jsonResponse({ ok: false, error: 'Session listing not supported' }, 501)
			}
			const sessions = await sessionAdapter.listManagedSessions(user.id)
			const ownedSession = sessions.find((session) => session.id === sessionId)
			if (!ownedSession) {
				return jsonResponse({ ok: false, error: 'Session not found' }, 404)
			}
			try {
				await sessionAdapter.revokeManagedSession(user.id, ownedSession.id)
			} catch (error) {
				if (isUnsupportedError(error)) {
					return jsonResponse({ ok: false, error: 'Session invalidation not supported' }, 501)
				}
				return jsonResponse({ ok: false, error: 'Failed to revoke session' }, 500)
			}
			if (currentManagementId === sessionId && sessionAdapter.deleteSessionCookie) {
				sessionAdapter.deleteSessionCookie(event.cookies)
			}
			return jsonResponse({ ok: true })
		}

		if (revokeAll) {
			if (typeof sessionAdapter.invalidateUserSessions !== 'function') {
				return jsonResponse({ ok: false, error: 'Bulk session revocation not supported' }, 501)
			}
			try {
				await sessionAdapter.invalidateUserSessions(user.id)
			} catch (error) {
				if (isUnsupportedError(error)) {
					return jsonResponse({ ok: false, error: 'Bulk session revocation not supported' }, 501)
				}
				return jsonResponse({ ok: false, error: 'Failed to revoke sessions' }, 500)
			}
			if (sessionAdapter.deleteSessionCookie) {
				sessionAdapter.deleteSessionCookie(event.cookies)
			}
			return jsonResponse({ ok: true })
		}

		if (revokeOthers) {
			if (
				typeof sessionAdapter.listManagedSessions !== 'function' ||
				typeof sessionAdapter.revokeManagedSession !== 'function'
			) {
				return jsonResponse({ ok: false, error: 'Session listing not supported' }, 501)
			}
			const sessions = await sessionAdapter.listManagedSessions(user.id)
			try {
				await Promise.all(
					sessions
						.filter((session) => session.id !== currentManagementId)
						.map((session) => sessionAdapter.revokeManagedSession!(user.id, session.id))
				)
			} catch (error) {
				if (isUnsupportedError(error)) {
					return jsonResponse({ ok: false, error: 'Session invalidation not supported' }, 501)
				}
				return jsonResponse({ ok: false, error: 'Failed to revoke sessions' }, 500)
			}
			return jsonResponse({ ok: true })
		}

		return jsonResponse({ ok: false, error: 'Missing revoke target' }, 400)
	}
}
