import type { AuthLocals, RequestEventLike } from '../types/auth.js'
import { type AuthEventEmitter, createAuthEvent } from './events.js'

type Actor = {
	id: string | number;
	role?: string;
	roles?: string[];
}

type AuthorizerContext = {
	event: RequestEventLike;
	emitter?: AuthEventEmitter;
}

function resolveAuthRoles(actor: Actor): string[] {
	const base = actor.role ? [ actor.role ] : []
	return [ ...base, ...(actor.roles ?? []) ]
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
	const ok = requiredAuthRoles.some(role => authRoles.includes(role))
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
