import { redirect } from "@sveltejs/kit";
import {
	generateMagicLinkToken,
	generateOtp,
	hashToken,
} from "../utils/magic-link.js";
import { createRateLimiter } from "../utils/rate-limit.js";
import { sanitizeUser as defaultSanitizeUser } from "../utils/sanitize.js";
import { jsonResponse, parseRequestData } from "../utils/http.js";
import type { RequestHandler } from "@sveltejs/kit";
import type {
	AuthLocals,
	AuthHooks,
	RequestEventLike,
} from "../types/auth.js";
import type { User } from "../types/index.js";
import type { Session } from "../types/index.js";
import { ensureSessionAfterLogin, type OnLoginMode } from "../utils/session-lifecycle.js";
import { AuthPrincipalResolutionError } from "../errors/auth.js";
import { auditAuthEvent } from "../security/audit.js";
import { isSafeRedirectPath } from "../utils/redirect.js";

type MagicLinkAdapterLike = {
	createToken: (params: {
		userId: string | null;
		email: string;
		tokenHash: string;
		otpHash?: string | null;
		expiresAt: Date;
		metadata?: Record<string, unknown>;
	}) => Promise<Record<string, unknown> | void>;
	findByTokenHash: (hash: string) => Promise<Record<string, unknown> | null>;
	findByEmailAndOtpHash: (params: {
		email: string;
		otpHash: string;
	}) => Promise<Record<string, unknown> | null>;
	deleteById: (id: string) => Promise<unknown>;
	deleteByEmail: (email: string) => Promise<unknown>;
};

type MagicLinkUserAdapterLike = {
	getUserByEmail: (email: string) => Promise<User | null>;
	getUserById: (id: string) => Promise<User | null>;
	createUser: (profile: {
		id: string;
		email: string;
		name: string;
		verified_email?: boolean;
	}) => Promise<User>;
	updateUser: (id: string, data: Record<string, unknown>) => Promise<User>;
};

type MagicLinkSessionAdapterLike = {
	createSession: (userId: string) => Promise<Session>;
	setSessionCookie?: (
		cookies: RequestEventLike["cookies"],
		session: Session,
	) => void;
};

type MagicLinkRequestConfig = {
	magicLinkAdapter: MagicLinkAdapterLike;
	databaseAdapter?: Pick<MagicLinkUserAdapterLike, "getUserByEmail">;
	sendEmail: (payload: {
		email: string;
		link: string;
		otp: string | null;
		token: string;
		expiresAt: Date;
		user: User | null;
		redirectTo: string;
		secureCookies: boolean;
	}) => Promise<void> | void;
	allowSignup?: boolean;
	expiresInMs?: number;
	magicLinkPath?: string;
	includeOtp?: boolean;
	otpDigits?: number;
	singleUsePerEmail?: boolean;
	secureCookies?: boolean;
	normalizeEmail?: (email: string) => string;
	exposeToken?: boolean;
	baseUrl?: string;
	rateLimit?: (event: RequestEventLike) => Promise<void> | void;
	getMetadata?: (event: RequestEventLike) => Promise<Record<string, unknown>>;
	trustProxyHeader?: boolean;
	key?: (event: RequestEventLike) => string;
};

type MagicLinkVerifyConfig = {
	magicLinkAdapter: MagicLinkAdapterLike;
	databaseAdapter?: MagicLinkUserAdapterLike;
	sessionAdapter: MagicLinkSessionAdapterLike;
	allowSignup?: boolean;
	createUser?: (email: string, event: RequestEventLike) => Promise<User>;
	onLogin?: AuthHooks["onLogin"];
	redirectAfterLogin?: string;
	isAuthenticated?: (locals: AuthLocals) => boolean;
	secureCookies?: boolean;
	normalizeEmail?: (email: string) => string;
	verifyRateLimit?: (key: string) => Promise<{ allowed: boolean }>;
	verifyRateLimitMax?: number;
	verifyRateLimitWindowMs?: number;
	sanitizeUser?: (user: User | null) => User | null;
	autoCreateSession?: boolean;
	onLoginMode?: OnLoginMode;
	trustProxyHeader?: boolean;
	key?: (event: RequestEventLike) => string;
};

type MagicLinkTokenRecord = {
	id?: string;
	userId?: string;
	email?: string;
	expiresAt?: string | Date;
	[key: string]: unknown;
};

type RateLimitKeyConfig = {
	key?: (event: RequestEventLike) => string;
	trustProxyHeader?: boolean;
};

function getRateLimitKey(event: RequestEventLike, config: RateLimitKeyConfig): string {
	if (config?.key) return config.key(event);
	if (event.getClientAddress) return event.getClientAddress();
	if (config?.trustProxyHeader) {
		return event.request.headers.get("x-forwarded-for") || "unknown";
	}
	return "unknown";
}

export function createMagicLinkRequestHandler(
	config: MagicLinkRequestConfig,
): RequestHandler {
	const {
		magicLinkAdapter,
		databaseAdapter,
		sendEmail,
		allowSignup = false,
		expiresInMs = 15 * 60 * 1000,
		magicLinkPath = "/auth/magic/verify",
		includeOtp = true,
		otpDigits = 6,
		singleUsePerEmail = true,
		secureCookies = true,
		normalizeEmail = (email: string) => email.trim().toLowerCase(),
		exposeToken = false,
		baseUrl,
		rateLimit,
		getMetadata,
	} = config;

	if (!magicLinkAdapter) {
		throw new Error("createMagicLinkRequestHandler requires magicLinkAdapter");
	}
	if (typeof sendEmail !== "function") {
		throw new Error("createMagicLinkRequestHandler requires sendEmail");
	}

	return async (event: RequestEventLike) => {
		if (rateLimit) {
			await rateLimit(event);
		}

		const data = await parseRequestData(event.request);
		const emailInput =
			(typeof data["email"] === "string" && data["email"]) ||
			(typeof data["identifier"] === "string" && data["identifier"]) ||
			"";
		const email = normalizeEmail(String(emailInput || ""));

		if (!email) {
			return jsonResponse({ ok: false, error: "Email required" }, 400);
		}

		const user = databaseAdapter
			? await databaseAdapter.getUserByEmail(email)
			: null;

		if (!user && !allowSignup) {
			return jsonResponse({ ok: true }, 200);
		}

		if (singleUsePerEmail) {
			await magicLinkAdapter.deleteByEmail(email);
		}

		const token = await generateMagicLinkToken();
		const tokenHash = await hashToken(token);
		const otp = includeOtp ? await generateOtp(otpDigits) : null;
		const otpHash = otp ? await hashToken(otp) : null;
		const expiresAt = new Date(Date.now() + expiresInMs);
		const metadata =
			typeof getMetadata === "function" ? await getMetadata(event) : {};

		await magicLinkAdapter.createToken({
			userId: user?.id ?? null,
			email,
			tokenHash,
			otpHash,
			expiresAt,
			metadata,
		});

		const redirectToRaw = typeof data["redirectTo"] === "string" ? data["redirectTo"] : "";
		const redirectTo = isSafeRedirectPath(redirectToRaw) ? redirectToRaw : "";
		const origin = baseUrl || event.url.origin;
		const url = new URL(magicLinkPath, origin);
		url.searchParams.set("token", token);
		if (redirectTo) {
			url.searchParams.set("redirectTo", redirectTo);
		}

		await sendEmail({
			email,
			link: url.toString(),
			otp,
			token,
			expiresAt,
			user,
			redirectTo,
			secureCookies,
		});

		if (exposeToken) {
			return jsonResponse({ ok: true, token, otp });
		}

		return jsonResponse({ ok: true });
	};
}

export function createMagicLinkVerifyHandler(
	config: MagicLinkVerifyConfig,
) {
	const {
		magicLinkAdapter,
		databaseAdapter,
		sessionAdapter,
		allowSignup = false,
		createUser,
		onLogin,
		redirectAfterLogin = "/",
		isAuthenticated = (locals: AuthLocals) => !!locals.user,
		secureCookies = true,
		normalizeEmail = (email: string) => email.trim().toLowerCase(),
		verifyRateLimit,
		verifyRateLimitMax = 5,
		verifyRateLimitWindowMs = 10 * 60 * 1000,
		sanitizeUser = defaultSanitizeUser,
		autoCreateSession = true,
		onLoginMode = "augment",
	} = config;

	if (!magicLinkAdapter) {
		throw new Error("createMagicLinkVerifyHandler requires magicLinkAdapter");
	}
	if (!sessionAdapter) {
		throw new Error("createMagicLinkVerifyHandler requires sessionAdapter");
	}

	const internalLimiter =
		typeof verifyRateLimit === "function"
			? verifyRateLimit
			: createRateLimiter({
					windowMs: verifyRateLimitWindowMs,
					max: verifyRateLimitMax,
					keyPrefix: "mlv",
				});

	return async (event: RequestEventLike) => {
		if (isAuthenticated(event.locals)) {
			throw redirect(302, redirectAfterLogin);
		}

		const data = await parseRequestData(event.request);
		const token =
			(typeof data["token"] === "string" && data["token"]) ||
			event.url.searchParams.get("token");
		const otp = (typeof data["otp"] === "string" && data["otp"]) || (typeof data["code"] === "string" && data["code"]);
		const emailInput =
			(typeof data["email"] === "string" && data["email"]) ||
			event.url.searchParams.get("email") ||
			"";
		const email = normalizeEmail(String(emailInput || ""));

		if (!token && !(otp && email)) {
			return jsonResponse({ ok: false, error: "Invalid magic link" }, 400);
		}

		const ipKey = getRateLimitKey(event, config);
		const identifier = email || (token ? await hashToken(token) : "unknown");
		const rateKey = `${identifier}:${ipKey}`;
		const rateResult = await internalLimiter(rateKey);
		if (!rateResult?.allowed) {
			return jsonResponse(
				{ ok: false, error: "Too many attempts. Try again later." },
				429,
			);
		}

		let record: MagicLinkTokenRecord | null = null;

		if (token) {
			const tokenHash = await hashToken(token);
			record = await magicLinkAdapter.findByTokenHash(tokenHash);
		} else if (otp && email) {
			const otpHash = await hashToken(otp);
			record = await magicLinkAdapter.findByEmailAndOtpHash({
				email,
				otpHash,
			});
		}

		if (!record) {
			auditAuthEvent("magic_link.invalid", {
				email,
				hasToken: Boolean(token),
				hasOtp: Boolean(otp),
			});
			return jsonResponse({ ok: false, error: "Invalid magic link" }, 400);
		}

		const expiresAt = record["expiresAt"];
		if (expiresAt && new Date(expiresAt) < new Date()) {
			const recordId = record["id"];
			if (typeof recordId === "string") {
				await magicLinkAdapter.deleteById(recordId);
			}
			auditAuthEvent("magic_link.expired", {
				email: record["email"] ?? email,
			});
			return jsonResponse({ ok: false, error: "Magic link expired" }, 400);
		}

		const recordId = record["id"];
		if (typeof recordId === "string") {
			await magicLinkAdapter.deleteById(recordId);
		}

		let user: User | null = null;
		const recordUserId =
			typeof record["userId"] === "string" ? record["userId"] : null;
		const recordEmail =
			typeof record["email"] === "string" ? record["email"] : null;
		if (databaseAdapter) {
			if (recordUserId) {
				user = await databaseAdapter.getUserById(recordUserId);
			}
			if (!user && (recordEmail || email)) {
				user = await databaseAdapter.getUserByEmail(recordEmail || email);
			}
		}

		if (!user && allowSignup && databaseAdapter) {
			if (typeof createUser === "function") {
				user = await createUser(recordEmail || email, event);
			} else {
				const signupEmail = recordEmail || email;
				const signupName = signupEmail.split("@")[0] ?? "";
				user = await databaseAdapter.createUser({
					id: signupEmail,
					email: signupEmail,
					name: signupName,
					verified_email: true,
				});
			}
		}

		if (user && databaseAdapter && user.emailVerified === false) {
			try {
				await databaseAdapter.updateUser(user.id, { emailVerified: true });
			} catch {}
		}

		let userId = user?.id ? String(user.id) : recordUserId;

		if (onLogin) {
			const profileEmail = recordEmail || email;
			const profileName = user?.name || (profileEmail.split("@")[0] ?? "");
			const profile = {
				id: userId || profileEmail,
				email: profileEmail,
				name: profileName,
			};
			const hookResult = await onLogin(event, profile, null, user);
			if (hookResult?.userId) userId = String(hookResult.userId);
		}
		try {
			userId = await ensureSessionAfterLogin({
				event,
				sessionAdapter,
				userId,
				autoCreateSession,
				onLoginMode,
			});
		} catch (error) {
			if (error instanceof AuthPrincipalResolutionError) {
				return jsonResponse({ ok: false, error: error.message }, error.status);
			}
			throw error;
		}

		if (event.request.method === "GET") {
			throw redirect(302, redirectAfterLogin);
		}

		return jsonResponse({ ok: true, user: sanitizeUser(user) });
	};
}
