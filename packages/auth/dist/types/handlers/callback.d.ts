import type { OAuthProvider } from "../providers/base.js";
import type { AuthLocals, RequestEventLike } from "../types/auth.js";
import type { OAuthProfile, OAuthTokens } from "../types/index.js";
type CallbackConfig = {
    providers: Record<string, OAuthProvider>;
    redirectAfterLogin?: string;
    isAuthenticated?: (locals: AuthLocals) => boolean;
    onAuthenticated: (event: RequestEventLike, profile: OAuthProfile, tokens: OAuthTokens) => Promise<void> | void;
    onError?: (event: RequestEventLike, error: unknown) => Promise<void> | void;
};
/**
 * Create a callback route handler for OAuth providers
 *
 * @param {Object} config - Handler configuration
 * @param {Object.<string, import('../providers/base.js').OAuthProvider>} config.providers - Provider instances mapped by name
 * @param {string} [config.redirectAfterLogin] - URL to redirect to after successful auth
 * @param {Function} [config.isAuthenticated] - Function to check if user is authenticated (receives event.locals)
 * @param {Function} config.onAuthenticated - Called with (event, profile, tokens) after successful auth
 * @param {Function} [config.onError] - Optional error handler, called with (event, error)
 * @returns {import('@sveltejs/kit').RequestHandler}
 *
 * @example
 * // In src/routes/auth/[provider]/callback/+server.ts
 * import { createCallbackHandler } from '@goobits/auth/handlers';
 * import { GoogleProvider } from '@goobits/auth/providers';
 *
 * const googleProvider = new GoogleProvider({...});
 *
 * export const GET = createCallbackHandler({
 *   providers: { google: googleProvider },
 *   redirectAfterLogin: '/dashboard',
 *   isAuthenticated: (locals) => !!locals.user,
 *   onAuthenticated: async (event, profile, tokens) => {
 *     // Store tokens, create/update user, start session
 *     const user = await findOrCreateUser(profile);
 *     await sessionAdapter.createSession(user.id);
 *   }
 * });
 */
export declare function createCallbackHandler(config: CallbackConfig): (event: RequestEventLike) => Promise<never>;
export {};
