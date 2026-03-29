import { redirect, error } from "@sveltejs/kit";
import { OAuth2RequestError } from "arctic";
import { handleOAuthCallback } from "../utils/oauth.js";
import type { OAuthProvider } from "../providers/base.js";
import type { AuthLocals, RequestEventLike } from "../types/auth.js";
import type { OAuthProfile, OAuthTokens } from "../types/index.js";
import { getLogger } from "../utils/logger.js";
import { AuthPrincipalResolutionError } from "../errors/auth.js";

type CallbackConfig = {
	providers: Record<string, OAuthProvider>;
	redirectAfterLogin?: string;
	isAuthenticated?: (locals: AuthLocals) => boolean;
	onAuthenticated: (
		event: RequestEventLike,
		profile: OAuthProfile,
		tokens: OAuthTokens,
	) => Promise<void> | void;
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
export function createCallbackHandler(config: CallbackConfig) {
	const {
		providers,
		redirectAfterLogin = "/",
		isAuthenticated = (locals: AuthLocals) => !!locals.user,
		onAuthenticated,
		onError,
	} = config;
	const log = getLogger();

	const isStatusError = (value: unknown): value is { status: number } =>
		typeof value === "object" &&
		value !== null &&
		"status" in value &&
		typeof (value as { status?: unknown }).status === "number";

	return async (event: RequestEventLike) => {
		const { params, locals, url } = event;

		try {
			// Already authenticated - redirect
			if (isAuthenticated(locals)) {
				throw redirect(302, redirectAfterLogin);
			}

			const providerName = String(params["provider"] ?? "");
			const providerInstance = providers[providerName];

			if (!providerInstance) {
				error(400, "Invalid OAuth provider");
			}

			// Extract Apple user data and callback params if present (POST form data)
			let appleUserData: string | null = null;
			let overrideParams: { code: string | null; state: string | null } | null = null;
			if (providerName === "apple" && event.request.method === "POST") {
				const formData = await event.request.formData();
				appleUserData = formData.get("user")?.toString() ?? null;
				overrideParams = {
					code: formData.get("code")?.toString() ?? null,
					state: formData.get("state")?.toString() ?? null,
				};
			}

			// Handle OAuth callback
			const callbacks: Parameters<typeof handleOAuthCallback>[0]["callbacks"] = {
				onAuthenticated: async (userProfile: OAuthProfile, tokens: OAuthTokens) => {
					await onAuthenticated(event, userProfile, tokens);
				},
				...(onError
					? { onError: async (err: unknown) => onError(event, err) }
					: {}),
			};
			await handleOAuthCallback({
				event,
				provider: providerName,
				providerInstance,
				appleUserData,
				overrideParams,
				callbacks,
			});

			throw redirect(302, redirectAfterLogin);
		} catch (err) {
			// Handle OAuth2 errors
			if (err instanceof OAuth2RequestError) {
				error(400, "OAuth authentication failed");
			}

			// Re-throw redirects and errors
			if (isStatusError(err)) {
				throw err;
			}
			if (err instanceof AuthPrincipalResolutionError) {
				error(err.status, err.message);
			}

			// Log and throw generic error
			log.error?.("Authentication error:", err);
			error(500, "Authentication system error");
		}
	};
}
