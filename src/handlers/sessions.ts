import type { SessionAdapter } from '../adapters/session/SessionAdapter.ts'
import { AuthAdapterCapabilityError } from '../errors/AuthPrincipalResolutionError.ts'
import type { AuthLocals, RequestEventLike } from '../types/auth.ts'
import type { Session } from '../types/index.ts'
import { jsonResponse, parseRequestData } from '../utils/http.ts'

type SessionManagementAdapter = Partial<
	Pick<
		SessionAdapter,
		'listSessions' | 'invalidateSession' | 'invalidateUserSessions' | 'deleteSessionCookie'
	>
>

type SessionHandlerConfig = {
	sessionAdapter: SessionManagementAdapter
	isAuthenticated?: (locals: AuthLocals) => boolean
	getUser?: (locals: AuthLocals) => { id: string }
	getSession?: (locals: AuthLocals) => Session | null
}

const managementIdFor = (session: Session): string => session.managementId ?? session.id

const toSafeSessionSummary = (session: Session, currentManagementId?: string) => ({
	id: managementIdFor(session),
	userId: session.userId,
	expiresAt: session.expiresAt,
	createdAt: session.createdAt ?? null,
	lastActiveAt: session.lastActiveAt ?? null,
	ip: session.ip ?? null,
	userAgent: session.userAgent ?? null,
	current: currentManagementId === managementIdFor(session)
})

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

		if (typeof sessionAdapter.listSessions !== 'function') {
			return jsonResponse({ ok: false, error: 'Session listing not supported' }, 501)
		}

		const user = getUser(event.locals)
		const current = getSession(event.locals)
		const sessions = await sessionAdapter.listSessions(user.id)
		const currentManagementId = current?.managementId ?? current?.id
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

		const isUnsupportedError = (error: unknown): boolean =>
			error instanceof AuthAdapterCapabilityError ||
			(error instanceof Error &&
				(error.message.includes('not support') || error.message.includes('not implemented')))

		const data = await parseRequestData(event.request)
		const user = getUser(event.locals)
		const current = getSession(event.locals)
		const currentManagementId = current?.managementId ?? current?.id

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
			if (typeof sessionAdapter.listSessions !== 'function') {
				return jsonResponse({ ok: false, error: 'Session listing not supported' }, 501)
			}
			const sessions = await sessionAdapter.listSessions(user.id)
			const ownedSession = sessions.find((session) => managementIdFor(session) === sessionId)
			if (!ownedSession) {
				return jsonResponse({ ok: false, error: 'Session not found' }, 404)
			}
			if (typeof sessionAdapter.invalidateSession !== 'function') {
				return jsonResponse({ ok: false, error: 'Session invalidation not supported' }, 501)
			}
			try {
				await sessionAdapter.invalidateSession(managementIdFor(ownedSession))
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
			if (typeof sessionAdapter.listSessions !== 'function') {
				return jsonResponse({ ok: false, error: 'Session listing not supported' }, 501)
			}
			const sessions = await sessionAdapter.listSessions(user.id)
			if (typeof sessionAdapter.invalidateSession !== 'function') {
				return jsonResponse({ ok: false, error: 'Session invalidation not supported' }, 501)
			}
			try {
				await Promise.all(
					sessions
						.filter((session) => managementIdFor(session) !== currentManagementId)
						.map((session) => sessionAdapter.invalidateSession!(managementIdFor(session)))
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
