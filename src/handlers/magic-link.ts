import { redirect } from "@sveltejs/kit";
import {
	generateMagicLinkToken,
	generateOtp,
	hashToken,
} from "../utils/magic-link.ts";
import { createRateLimiter } from "../utils/rate-limit.ts";
import { sanitizeUser as defaultSanitizeUser } from "../utils/sanitize.ts";
import { jsonResponse, parseRequestData } from "../utils/http.ts";
import type { RequestHandler } from "@sveltejs/kit";
import type {
	AuthLocals,
	MagicLinkConfig,
	RequestEventLike,
} from "../types/auth.ts";
import type { User } from "../types/index.ts";

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

type MagicLinkDatabaseAdapterLike = {
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
	createSession: (userId: string) => Promise<{ id: string; expiresAt: Date } | Record<string, unknown>>;
	setSessionCookie?: (
		cookies: RequestEventLike["cookies"],
		session: unknown,
		options?: { secure?: boolean },
	) => void;
};

function getRateLimitKey(event: RequestEventLike, config: MagicLinkConfig): string {
	if (config?.key) return config.key(event);
	if (event.getClientAddress) return event.getClientAddress();
	if (config?.trustProxyHeader) {
		return event.request.headers.get("x-forwarded-for") || "unknown";
	}
	return "unknown";
}

export function createMagicLinkRequestHandler(
	config: MagicLinkConfig & {
		magicLinkAdapter: MagicLinkAdapterLike;
		databaseAdapter?: Pick<MagicLinkDatabaseAdapterLike, "getUserByEmail">;
	},
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
			(typeof data.email === "string" && data.email) ||
			(typeof data.identifier === "string" && data.identifier) ||
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

		const redirectTo = typeof data.redirectTo === "string" ? data.redirectTo : "";
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
	config: MagicLinkConfig & {
		magicLinkAdapter: MagicLinkAdapterLike;
		databaseAdapter?: MagicLinkDatabaseAdapterLike;
		sessionAdapter: MagicLinkSessionAdapterLike;
		redirectAfterLogin?: string;
		isAuthenticated?: (locals: AuthLocals) => boolean;
	},
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
			(typeof data.token === "string" && data.token) ||
			event.url.searchParams.get("token");
		const otp = (typeof data.otp === "string" && data.otp) || (typeof data.code === "string" && data.code);
		const emailInput =
			(typeof data.email === "string" && data.email) ||
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

		let record: Record<string, any> | null = null;

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
			return jsonResponse({ ok: false, error: "Invalid magic link" }, 400);
		}

		if (record.expiresAt && new Date(record.expiresAt) < new Date()) {
			if (record.id) {
				await magicLinkAdapter.deleteById(record.id);
			}
			return jsonResponse({ ok: false, error: "Magic link expired" }, 400);
		}

		if (record.id) {
			await magicLinkAdapter.deleteById(record.id);
		}

		let user: User | null = null;
		if (databaseAdapter) {
			if (record.userId) {
				user = await databaseAdapter.getUserById(record.userId);
			}
			if (!user && (record.email || email)) {
				user = await databaseAdapter.getUserByEmail(record.email || email);
			}
		}

		if (!user && allowSignup && databaseAdapter) {
			if (typeof createUser === "function") {
				user = await createUser(record.email || email, event);
			} else {
				user = await databaseAdapter.createUser({
					id: record.email || email,
					email: record.email || email,
					name: (record.email || email).split("@")[0],
					verified_email: true,
				});
			}
		}

		if (user && databaseAdapter && user.emailVerified === false) {
			try {
				await databaseAdapter.updateUser(user.id, { emailVerified: true });
			} catch {}
		}

		let userId = user?.id ? String(user.id) : record?.userId ? String(record.userId) : null;

		if (onLogin) {
			const profile = {
				id: userId || record.email || email,
				email: record.email || email,
				name: user?.name || (record.email || email).split("@")[0],
			};
			const hookResult = await onLogin(event, profile, null, user);
			if (hookResult?.userId) userId = String(hookResult.userId);
			if (hookResult?.id) userId = String(hookResult.id);
			if (hookResult?.user?.id) userId = String(hookResult.user.id);
		} else if (userId) {
			const session = await sessionAdapter.createSession(userId);
			if (sessionAdapter.setSessionCookie) {
				sessionAdapter.setSessionCookie(event.cookies, session, {
					secure: secureCookies,
				});
			}
		} else {
			return jsonResponse({ ok: false, error: "User not found" }, 400);
		}

		if (event.request.method === "GET") {
			throw redirect(302, redirectAfterLogin);
		}

		return jsonResponse({ ok: true, user: sanitizeUser(user) });
	};
}
