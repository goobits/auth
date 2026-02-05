import { redirect } from "@sveltejs/kit";
import { sanitizeUser as defaultSanitizeUser } from "../utils/sanitize.ts";
import type { RequestEventLike } from "../types/auth.ts";
import { getLogger } from "../utils/logger.ts";
import type { User } from "../types/index.ts";

type RateLimitConfig = {
	check?: (key: string) => Promise<{ allowed: boolean }>;
	key?: (event: RequestEventLike) => string;
	trustProxyHeader?: boolean;
};

function getRateLimitKey(event: RequestEventLike, rateLimit?: RateLimitConfig) {
	if (rateLimit?.key) return rateLimit.key(event);
	if (event.getClientAddress) return event.getClientAddress();
	if (rateLimit?.trustProxyHeader) {
		return event.request.headers.get("x-forwarded-for") || "unknown";
	}
	return "unknown";
}

/**
 * Create a signin handler for credentials-based authentication
 * @param {Object} config - Handler configuration
 * @param {import('../providers/credentials.ts').CredentialsProvider} config.credentialsProvider - Credentials provider
 * @param {import('../adapters/database/base.ts').DatabaseAdapter} config.userAdapter - User adapter
 * @param {import('../adapters/session/base.ts').SessionAdapter} config.sessionAdapter - Session adapter
 * @param {Function} [config.onSignin] - Callback after successful signin (user) => Promise<void>
 * @param {Object} [config.csrf] - CSRF validation config
 * @param {Function} [config.csrf.validate] - Async function (event) => boolean
 * @param {string} [config.csrf.errorMessage] - Error message for invalid CSRF
 * @param {Object} [config.rateLimit] - Rate limit config
 * @param {Function} [config.rateLimit.check] - Async function (key) => { allowed }
 * @param {Function} [config.rateLimit.key] - Function (event) => string for rate limit key
 * @param {string} [config.redirectTo] - Redirect URL after signin (default: '/')
 * @returns {Function} SvelteKit request handler
 */
export function createSigninHandler(config: {
	credentialsProvider: {
		authenticate: (input: {
			email: string;
			password: string;
			userAdapter: unknown;
		}) => Promise<{ user: User | null; valid: boolean }>;
	};
	userAdapter: unknown;
	sessionAdapter: {
		createSession: (userId: string) => Promise<{ id: string; expiresAt: Date }>;
		setSessionCookie: (
			cookies: RequestEventLike["cookies"],
			session: { id: string; expiresAt: Date },
		) => void;
	};
	onSignin?: (user: User | null) => Promise<void> | void;
	csrf?: { validate?: (event: RequestEventLike) => Promise<boolean>; errorMessage?: string };
	rateLimit?: RateLimitConfig;
	redirectTo?: string;
	sanitizeUser?: (user: User | null) => User | null;
}) {
	const {
		credentialsProvider,
		userAdapter,
		sessionAdapter,
		onSignin,
		csrf,
		rateLimit,
		redirectTo = "/",
		sanitizeUser = defaultSanitizeUser,
	} = config;

	const log = getLogger();

	return async (event: RequestEventLike) => {
		if (csrf?.validate) {
			const valid = await csrf.validate(event);
			if (!valid) {
				return {
					error: csrf.errorMessage || "Invalid CSRF token",
					success: false,
				};
			}
		}

		if (rateLimit?.check) {
			const key = getRateLimitKey(event, rateLimit);
			const result = await rateLimit.check(key);
			if (!result?.allowed) {
				return {
					error: "Too many attempts. Try again later.",
					success: false,
				};
			}
		}

		const formData = await event.request.formData();
		const email = formData.get("email")?.toString();
		const password = formData.get("password")?.toString();

		if (!email || !password) {
			return {
				error: "Email and password are required",
				success: false,
			};
		}

		try {
			// Authenticate user
			const { user, valid } = await credentialsProvider.authenticate({
				email,
				password,
				userAdapter,
			});

			if (!valid || !user) {
				return {
					error: "Invalid email or password",
					success: false,
				};
			}

			const safeUser = sanitizeUser(user) as User | null;

			// Call onSignin hook if provided
			if (onSignin) {
				await onSignin(safeUser);
			}

			// Create session
			const session = await sessionAdapter.createSession(user.id);
			sessionAdapter.setSessionCookie(event.cookies, session);

			// Redirect if configured
			if (redirectTo) {
				throw redirect(303, redirectTo);
			}

			return {
				success: true,
				user: safeUser,
			};
		} catch (error) {
			log.error?.("[Signin] Error:", error);

			// Check if this is a redirect (don't treat as error)
			if (
				error &&
				typeof error === "object" &&
				"status" in error &&
				((error as { status?: number }).status === 302 ||
					(error as { status?: number }).status === 303)
			) {
				throw error;
			}

			return {
				error:
					(error instanceof Error ? error.message : undefined) ||
					"An error occurred during signin",
				success: false,
			};
		}
	};
}
