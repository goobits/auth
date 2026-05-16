import type { AuthLocals, RequestEventLike } from "../types/auth.js";
import { createAuthEvent, type AuthEventEmitter } from "./events.js";

type Actor = {
	id: string | number;
	role?: string;
	roles?: string[];
};

type AuthorizerContext = {
	event: RequestEventLike;
	emitter?: AuthEventEmitter;
};

function resolveRoles(actor: Actor): string[] {
	const base = actor.role ? [actor.role] : [];
	return [...base, ...(actor.roles ?? [])];
}

async function emitDenied(
	context: AuthorizerContext,
	message: string,
	details: Record<string, unknown> = {},
): Promise<void> {
	if (!context.emitter) return;
	await context.emitter(
		createAuthEvent({
			name: "authz.denied",
			severity: "warn",
			route: context.event.url.pathname,
			method: context.event.request.method,
			status: 403,
			message,
			userId: context.event.locals.user?.id ? String(context.event.locals.user.id) : null,
			details,
		}),
	);
}

export function requireAuthenticated(
	locals: AuthLocals,
): asserts locals is AuthLocals & { user: NonNullable<AuthLocals["user"]> } {
	if (!locals.user) {
		throw new Error("Unauthorized");
	}
}

export async function requireRole(
	context: AuthorizerContext,
	requiredRoles: string[],
): Promise<void> {
	requireAuthenticated(context.event.locals);
	const actor = context.event.locals.user as Actor;
	const roles = resolveRoles(actor);
	const ok = requiredRoles.some((role) => roles.includes(role));
	if (!ok) {
		await emitDenied(context, "Missing required role", {
			requiredRoles,
			actorRoles: roles,
		});
		throw new Error("Forbidden");
	}
}

export async function requireOwnership(
	context: AuthorizerContext,
	resourceOwnerId: string | number,
): Promise<void> {
	requireAuthenticated(context.event.locals);
	const actorId = String(context.event.locals.user!.id);
	if (actorId !== String(resourceOwnerId)) {
		await emitDenied(context, "Ownership check failed", {
			actorId,
			resourceOwnerId: String(resourceOwnerId),
		});
		throw new Error("Forbidden");
	}
}
