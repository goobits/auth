import { redirect } from "@sveltejs/kit";
import { sanitizeUser as defaultSanitizeUser } from "../utils/sanitize.js";
import type { RequestEventLike } from "../types/auth.js";
import { getLogger } from "../utils/logger.js";
import type { User } from "../types/index.js";
import type { VerificationTokenAdapter } from "../adapters/verification-token/base.js";

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
 * Create a signup handler for credentials-based authentication
 * @param {Object} config - Handler configuration
 * @param {import('../providers/credentials.js').CredentialsProvider} config.credentialsProvider - Credentials provider
 * @param {import('../adapters/database/base.js').UserAdapter} config.userAdapter - User adapter
 * @param {import('../adapters/session/base.js').SessionAdapter} config.sessionAdapter - Session adapter
 * @param {import('../adapters/verification-token/base.js').VerificationTokenAdapter} [config.verificationTokenAdapter] - Verification token adapter (optional)
 * @param {Function} [config.onSignup] - Callback after user creation (user) => Promise<void>
 * @param {Function} [config.sendVerificationEmail] - Function to send verification email (email, token) => Promise<void>
 * @param {Object} [config.csrf] - CSRF validation config
 * @param {Function} [config.csrf.validate] - Async function (event) => boolean
 * @param {string} [config.csrf.errorMessage] - Error message for invalid CSRF
 * @param {Object} [config.rateLimit] - Rate limit config
 * @param {Function} [config.rateLimit.check] - Async function (key) => { allowed }
 * @param {Function} [config.rateLimit.key] - Function (event) => string for rate limit key
 * @param {string} [config.redirectTo] - Redirect URL after signup (default: '/')
 * @param {boolean} [config.autoLogin] - Automatically log in user after signup (default: true)
 * @param {Object} [config.fields] - Form field names (email, password, name)
 * @param {string[]} [config.metadataFields] - Form fields to pass as metadata to createUser
 * @param {Function} [config.getSignupMetadata] - Compute additional metadata from FormData
 * @returns {Function} SvelteKit request handler
 */
export function createSignupHandler(config: {
	credentialsProvider: {
		signUp: (input: {
			email: string;
			password: string;
			name?: string;
			metadata?: Record<string, unknown>;
			userAdapter: unknown;
		}) => Promise<User>;
	};
	userAdapter: { getUserByEmail: (email: string) => Promise<User | null> };
	sessionAdapter?: {
		createSession: (userId: string) => Promise<{ id: string; expiresAt: Date }>;
		setSessionCookie: (
			cookies: RequestEventLike["cookies"],
			session: { id: string; expiresAt: Date },
		) => void;
	};
	verificationTokenAdapter?: VerificationTokenAdapter;
	onSignup?: (user: User | null) => Promise<void> | void;
	sendVerificationEmail?: (email: string, token: string) => Promise<void> | void;
	csrf?: { validate?: (event: RequestEventLike) => Promise<boolean>; errorMessage?: string };
	rateLimit?: RateLimitConfig;
	redirectTo?: string;
	autoLogin?: boolean;
	sanitizeUser?: (user: User | null) => User | null;
	fields?: { email?: string; password?: string; name?: string };
	metadataFields?: string[];
	getSignupMetadata?: (formData: FormData) => Record<string, unknown> | Promise<Record<string, unknown>>;
}) {
	const {
		credentialsProvider,
		userAdapter,
		sessionAdapter,
		verificationTokenAdapter,
		onSignup,
		sendVerificationEmail,
		csrf,
		rateLimit,
		redirectTo = "/",
		autoLogin = true,
		sanitizeUser = defaultSanitizeUser,
		fields,
		metadataFields,
		getSignupMetadata,
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
		const emailFieldName = fields?.email ?? "email";
		const passwordFieldName = fields?.password ?? "password";
		const nameFieldName = fields?.name ?? "name";

		const email = formData.get(emailFieldName)?.toString();
		const password = formData.get(passwordFieldName)?.toString();
		const name = formData.get(nameFieldName)?.toString();

		if (!email || !password) {
			return {
				error: "Email and password are required",
				success: false,
			};
		}

		try {
			// Check if user already exists
			const existingUser = await userAdapter.getUserByEmail(email);
			if (existingUser) {
				return {
					error: "Unable to create account with those details",
					success: false,
				};
			}

			// Create user
			const signUpInput: {
				email: string;
				password: string;
				name?: string;
				metadata?: Record<string, unknown>;
				userAdapter: typeof userAdapter;
			} = {
				email,
				password,
				userAdapter,
			};
			if (name) signUpInput.name = name;
			if (metadataFields?.length) {
				signUpInput.metadata = {};
				for (const field of metadataFields) {
					const value = formData.get(field);
					if (typeof value === "string" && value.trim().length > 0) {
						signUpInput.metadata[field] = value;
					}
				}
			}
			if (getSignupMetadata) {
				const extra = await getSignupMetadata(formData);
				signUpInput.metadata = {
					...(signUpInput.metadata ?? {}),
					...extra,
				};
			}
			const user = await credentialsProvider.signUp(signUpInput);

			const safeUser = sanitizeUser(user) as User | null;

			// Call onSignup hook if provided
			if (onSignup) {
				await onSignup(safeUser);
			}

			// Send verification email if adapter and sender provided
			if (verificationTokenAdapter && sendVerificationEmail) {
				try {
					const { createVerificationToken, VERIFICATION_TOKEN_TYPES } =
						await import("../utils/tokens.js");

					const token = await createVerificationToken({
						adapter: verificationTokenAdapter,
						userId: user.id,
						type: VERIFICATION_TOKEN_TYPES.EMAIL_VERIFICATION,
					});

					await sendVerificationEmail(user.email, token);
				} catch (emailError) {
					log.error?.(
						"[Signup] Failed to send verification email:",
						emailError,
					);
					// Don't fail signup if email fails
				}
			}

			// Auto-login if enabled
			if (autoLogin && sessionAdapter) {
				const session = await sessionAdapter.createSession(user.id);
				sessionAdapter.setSessionCookie(event.cookies, session);
			}

			// Redirect if configured
			if (redirectTo) {
				throw redirect(303, redirectTo);
			}

			return {
				success: true,
				user: safeUser,
			};
		} catch (error) {
			log.error?.("[Signup] Error:", error);

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
					error: "An error occurred during signup",
					success: false,
				};
		}
	};
}
