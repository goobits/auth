import { parseSessionTimestamp } from '../adapters/session/sessionAssurance.ts'
import type { AuthLocals, RequestEventLike } from '../types/auth.ts'
import type { Session } from '../types/core.ts'
import { type AuthEventEmitter, createAuthEvent } from './events.ts'

type Actor = {
	id: string | number
	role?: string
	roles?: string[]
}

type AuthorizerContext = {
	event: RequestEventLike
	emitter?: AuthEventEmitter
}

/** Freshness window for primary- and second-factor session assurance. */
export type SessionAssuranceWindow = {
	maxAgeMs: number
	now?: Date | number
	clockSkewMs?: number
}

function isRecent(value: unknown, options: SessionAssuranceWindow): boolean {
	if (!Number.isFinite(options.maxAgeMs) || options.maxAgeMs < 0) return false
	const timestamp = parseSessionTimestamp(value)
	const now = options.now instanceof Date ? options.now.getTime() : (options.now ?? Date.now())
	const clockSkewMs = options.clockSkewMs ?? 60_000
	if (!timestamp || !Number.isFinite(now) || clockSkewMs < 0) return false
	const age = now - timestamp.getTime()
	return age >= -clockSkewMs && age <= options.maxAgeMs
}

/** Returns whether the session's primary authentication is still recent enough. */
export function hasRecentPrimaryAuthentication(
	session: Session | null | undefined,
	options: SessionAssuranceWindow
): boolean {
	return Boolean(session && isRecent(session.createdAt, options))
}

/** Returns whether the session's MFA verification is still recent enough. */
export function hasRecentMfaVerification(
	session: Session | null | undefined,
	options: SessionAssuranceWindow
): boolean {
	return Boolean(session && isRecent(session.mfaVerifiedAt, options))
}

function resolveAuthRoles(actor: Actor): string[] {
	const base = actor.role ? [actor.role] : []
	return [...base, ...(actor.roles ?? [])]
}

async function emitDenied(
	context: AuthorizerContext,
	message: string,
	details: Record<string, unknown> = {}
): Promise<void> {
	if (!context.emitter) return
	await context.emitter(
		createAuthEvent({
			name: 'authz.denied',
			severity: 'warn',
			route: context.event.url.pathname,
			method: context.event.request.method,
			status: 403,
			message,
			userId: context.event.locals.user?.id ? String(context.event.locals.user.id) : null,
			details
		})
	)
}

/** Processes authenticated for auth security checks. */
export function requireAuthenticated(
	locals: AuthLocals
): asserts locals is AuthLocals & { user: NonNullable<AuthLocals['user']> } {
	if (!locals.user) {
		throw new Error('Unauthorized')
	}
}

/** Processes auth role for auth security checks. */
export async function requireAuthRole(
	context: AuthorizerContext,
	requiredAuthRoles: string[]
): Promise<void> {
	requireAuthenticated(context.event.locals)
	const actor = context.event.locals.user as Actor
	const authRoles = resolveAuthRoles(actor)
	const ok = requiredAuthRoles.some((role) => authRoles.includes(role))
	if (!ok) {
		await emitDenied(context, 'Missing required auth role', {
			requiredAuthRoles,
			actorAuthRoles: authRoles
		})
		throw new Error('Forbidden')
	}
}

/** Processes ownership for auth security checks. */
export async function requireOwnership(
	context: AuthorizerContext,
	resourceOwnerId: string | number
): Promise<void> {
	requireAuthenticated(context.event.locals)
	const actorId = String(context.event.locals.user!.id)
	if (actorId !== String(resourceOwnerId)) {
		await emitDenied(context, 'Ownership check failed', {
			actorId,
			resourceOwnerId: String(resourceOwnerId)
		})
		throw new Error('Forbidden')
	}
}
