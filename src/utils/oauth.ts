import { generateState, generateCodeVerifier } from "arctic";
import type { RequestEvent } from "@sveltejs/kit";
import type { Cookies } from "@sveltejs/kit";
import type { OAuthProvider } from "../providers/base.js";
import type { OAuthProfile, OAuthTokens } from "../types/index.js";
import type { RequestEventLike } from "../types/auth.js";

type CookiesLike = Pick<Cookies, "set" | "get" | "delete">;

type CookieOptions = {
	secure?: boolean;
	maxAge?: number;
	sameSite?: "lax" | "strict" | "none";
};

type OAuthCallbackParams = {
	code: string | null;
	state: string | null;
	storedState: string | null;
	storedCodeVerifier: string | null;
};

type OAuthCallbackOverrides = {
	code?: string | null;
	state?: string | null;
};

type OAuthCallbackHandlers = {
	onAuthenticated?: (
		profile: OAuthProfile,
		tokens: OAuthTokens,
	) => Promise<void> | void;
	onError?: (error: unknown) => Promise<void> | void;
};

/**
 * Create OAuth state and code verifier cookies
 * @param {Object} cookies - SvelteKit cookies object
 * @param {string} provider - Provider name (e.g., 'google', 'apple')
 * @param {Object} options - Cookie options
 * @param {boolean} [options.secure=true] - Use secure cookies
 * @param {number} [options.maxAge=1800] - Cookie max age in seconds (default 30 min)
 * @returns {{state: string, codeVerifier: string}}
 */
export function createOAuthCookies(
	cookies: CookiesLike,
	provider: string,
	options: CookieOptions = {},
): { state: string; codeVerifier: string } {
	const { secure = true, maxAge = 30 * 60, sameSite = "lax" } = options;

	const state = generateState();
	const codeVerifier = generateCodeVerifier();

	const cookieOptions = {
		httpOnly: true,
		path: "/",
		secure,
		sameSite,
		maxAge,
	};

	// Store state cookie
	cookies.set(`${provider}_oauth_state`, state, cookieOptions);

	// Store code verifier cookie
	cookies.set(`${provider}_oauth_code_verifier`, codeVerifier, {
		...cookieOptions,
		secure,
	});

	return { state, codeVerifier };
}

/**
 * Clean up OAuth cookies after authentication
 * @param {Object} cookies - SvelteKit cookies object
 * @param {string} provider - Provider name
 */
export function cleanupOAuthCookies(cookies: CookiesLike, provider: string): void {
	cookies.delete(`${provider}_oauth_state`, { path: "/" });
	cookies.delete(`${provider}_oauth_code_verifier`, { path: "/" });
}

/**
 * Validate OAuth callback parameters
 * @param {Object} params - Callback parameters
 * @param {string} params.code - Authorization code from provider
 * @param {string} params.state - State from callback
 * @param {string} params.storedState - State from cookies
 * @param {string} params.storedCodeVerifier - Code verifier from cookies
 * @returns {boolean}
 */
export function validateOAuthCallback(params: OAuthCallbackParams): boolean {
	const { code, state, storedState, storedCodeVerifier } = params;

	const stateMatches = timingSafeEqual(state ?? "", storedState ?? "");
	return !!(
		code &&
		storedCodeVerifier &&
		storedState &&
		stateMatches
	);
}

function timingSafeEqual(a: string, b: string): boolean {
	if (!a || !b || a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i += 1) {
		diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return diff === 0;
}

/**
 * Extract OAuth callback parameters from request
 * @param {Object} cookies - SvelteKit cookies object
 * @param {URL} url - Request URL
 * @param {string} provider - Provider name
 * @returns {{code: string | null, state: string | null, storedState: string | null, storedCodeVerifier: string | null}}
 */
export function getOAuthCallbackParams(
	cookies: CookiesLike,
	url: URL,
	provider: string,
	overrides: OAuthCallbackOverrides = {},
): OAuthCallbackParams {
	const code = overrides.code ?? url.searchParams.get("code");
	const state = overrides.state ?? url.searchParams.get("state");
	const storedState = cookies.get(`${provider}_oauth_state`) ?? null;
	const storedCodeVerifier =
		cookies.get(`${provider}_oauth_code_verifier`) ?? null;

	return { code, state, storedState, storedCodeVerifier };
}

/**
 * Create a generic OAuth callback handler
 * This handles the full OAuth flow including validation, profile fetching, and cleanup
 *
 * @param {Object} params
 * @param {import('@sveltejs/kit').RequestEvent} params.event - SvelteKit request event
 * @param {string} params.provider - Provider name
 * @param {import('../providers/base.js').OAuthProvider} params.providerInstance - Provider instance
 * @param {Object} params.callbacks - Lifecycle callbacks
 * @param {Function} params.callbacks.onAuthenticated - Called with (profile, tokens) after successful auth
 * @param {Function} [params.callbacks.onError] - Optional error handler
 * @param {string} [params.appleUserData] - Optional Apple user data from POST body
 * @returns {Promise<{profile: Object, tokens: Object}>}
 */
export async function handleOAuthCallback({
	event,
	provider,
	providerInstance,
	callbacks,
	appleUserData = null,
	overrideParams = null,
}: {
	event: RequestEvent | RequestEventLike | { cookies: CookiesLike; url: URL; request: Request };
	provider: string;
	providerInstance: OAuthProvider;
	callbacks: OAuthCallbackHandlers;
	appleUserData?: string | null;
	overrideParams?: OAuthCallbackOverrides | null;
}): Promise<{ profile: OAuthProfile; tokens: OAuthTokens }> {
	const { cookies, url } = event;
	let override: OAuthCallbackOverrides = overrideParams || {};
	if (!overrideParams) {
		try {
			if (event.request.method === "POST") {
				const formData = await event.request.formData();
				override = {
					code: formData.get("code")?.toString() ?? null,
					state: formData.get("state")?.toString() ?? null,
				};
			}
		} catch {}
	}

	try {
		// Extract and validate callback parameters
		const params = getOAuthCallbackParams(cookies, url, provider, override);

		if (!validateOAuthCallback(params)) {
			throw new Error("Invalid OAuth callback parameters");
		}
		if (!params.code || !params.storedCodeVerifier) {
			throw new Error("Missing OAuth parameters");
		}

		// Fetch user profile from provider
		let profile:
			| { profile: OAuthProfile; tokens: OAuthTokens }
			| null = null;
		if (provider === "apple" && appleUserData) {
				profile = await providerInstance.getUserProfile(
					params.code,
					params.storedCodeVerifier,
					appleUserData,
				);
			} else {
				profile = await providerInstance.getUserProfile(
					params.code,
					params.storedCodeVerifier,
				);
			}

		if (!profile?.profile) {
			throw new Error("Invalid provider profile");
		}

		// Cleanup OAuth cookies
		cleanupOAuthCookies(cookies, provider);

		// Call user-provided authentication handler
		if (callbacks.onAuthenticated) {
			await callbacks.onAuthenticated(profile.profile, profile.tokens);
		}

		return profile;
	} catch (error) {
		if (callbacks.onError) {
			await callbacks.onError(error);
		}
		// Cleanup OAuth cookies on error
		cleanupOAuthCookies(cookies, provider);
		throw error;
	}
}
