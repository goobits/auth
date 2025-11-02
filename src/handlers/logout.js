import { redirect } from "@sveltejs/kit";

/**
 * Create a logout route handler
 *
 * @param {Object} config - Handler configuration
 * @param {import('../adapters/session/base.js').SessionAdapter} config.sessionAdapter - Session adapter instance
 * @param {string} [config.redirectAfterLogout='/'] - URL to redirect to after logout
 * @param {Function} [config.getSession] - Function to get session from event.locals (default: locals => locals.session)
 * @param {Function} [config.onLogout] - Optional callback after session is invalidated, receives event
 * @returns {import('@sveltejs/kit').Actions}
 *
 * @example
 * // In src/routes/logout/+page.server.js
 * import { createLogoutHandler } from '@goobits/auth/handlers';
 * import { sessionAdapter } from '$lib/auth';
 *
 * export const actions = createLogoutHandler({
 *   sessionAdapter,
 *   redirectAfterLogout: '/sign-in',
 *   getSession: (locals) => locals.session,
 *   onLogout: async (event) => {
 *     // Optional cleanup (clear stores, etc.)
 *   }
 * });
 */
export function createLogoutHandler(config) {
	const {
		sessionAdapter,
		redirectAfterLogout = "/",
		getSession = (locals) => locals.session,
		onLogout,
	} = config;

	return {
		default: async (event) => {
			try {
				const session = getSession(event.locals);

				if (session) {
					await sessionAdapter.invalidateSession(session.id);
					sessionAdapter.deleteSessionCookie(event.cookies);
				}

				// Call optional cleanup callback
				if (onLogout) {
					await onLogout(event);
				}

				throw redirect(302, redirectAfterLogout);
			} catch (error) {
				// Re-throw redirects
				if (error.status === 302) throw error;

				console.error("Error during logout:", error);
				throw redirect(302, redirectAfterLogout);
			}
		},
	};
}
