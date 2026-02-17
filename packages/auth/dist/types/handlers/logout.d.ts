import type { Actions, RequestHandler } from "@sveltejs/kit";
import type { SessionAdapter } from "../adapters/session/base.js";
import type { AuthLocals, RequestEventLike } from "../types/auth.js";
/**
 * Create a logout route handler
 *
 * @param {Object} config - Handler configuration
 * @param {import('../adapters/session/base.js').SessionAdapter} config.sessionAdapter - Session adapter instance
 * @param {string} [config.redirectAfterLogout='/'] - URL to redirect to after logout
 * @param {Function} [config.getSession] - Function to get session from event.locals (default: locals => locals.session)
 * @param {Function} [config.onLogout] - Optional callback after session is invalidated, receives event
 * @returns {import('@sveltejs/kit').RequestHandler}
 *
 * @example
 * // In src/routes/logout/+page.server.ts
 * import { createLogoutHandler } from '@goobits/auth/handlers';
 * import { sessionAdapter } from '$lib/auth';
 *
 * export const POST = createLogoutHandler({
 *   sessionAdapter,
 *   redirectAfterLogout: '/sign-in',
 *   getSession: (locals) => locals.session,
 *   onLogout: async (event) => {
 *     // Optional cleanup (clear stores, etc.)
 *   }
 * });
 */
export declare function createLogoutHandler(config: {
    sessionAdapter: SessionAdapter;
    redirectAfterLogout?: string;
    getSession?: (locals: AuthLocals) => {
        id: string;
    } | null;
    onLogout?: (event: RequestEventLike) => Promise<void> | void;
}): RequestHandler;
export declare function createLogoutAction(config: {
    sessionAdapter: SessionAdapter;
    redirectAfterLogout?: string;
    getSession?: (locals: AuthLocals) => {
        id: string;
    } | null;
    onLogout?: (event: RequestEventLike) => Promise<void> | void;
}): Actions;
