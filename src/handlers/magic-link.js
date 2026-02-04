import { redirect } from "@sveltejs/kit";
import { generateMagicLinkToken, generateOtp, hashToken } from "../utils/magic-link.js";

async function parseRequestData(request) {
	const contentType = request.headers.get("content-type") || "";
	if (contentType.includes("application/json")) {
		return request.json().catch(() => ({}));
	}
	if (
		contentType.includes("application/x-www-form-urlencoded") ||
		contentType.includes("multipart/form-data")
	) {
		const form = await request.formData();
		return Object.fromEntries(form.entries());
	}
	return {};
}

function jsonResponse(payload, status = 200) {
	return new Response(JSON.stringify(payload), {
		status,
		headers: { "content-type": "application/json" },
	});
}

export function createMagicLinkRequestHandler(config) {
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
		normalizeEmail = (email) => email.trim().toLowerCase(),
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

	return async (event) => {
		if (rateLimit) {
			await rateLimit(event);
		}

		const data = await parseRequestData(event.request);
		const emailInput = data.email || data.identifier || "";
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

		const redirectTo = data.redirectTo || "";
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

export function createMagicLinkVerifyHandler(config) {
	const {
		magicLinkAdapter,
		databaseAdapter,
		sessionAdapter,
		allowSignup = false,
		createUser,
		onLogin,
		redirectAfterLogin = "/",
		isAuthenticated = (locals) => !!locals.user,
		secureCookies = true,
		normalizeEmail = (email) => email.trim().toLowerCase(),
	} = config;

	if (!magicLinkAdapter) {
		throw new Error("createMagicLinkVerifyHandler requires magicLinkAdapter");
	}
	if (!sessionAdapter) {
		throw new Error("createMagicLinkVerifyHandler requires sessionAdapter");
	}

	return async (event) => {
		if (isAuthenticated(event.locals)) {
			throw redirect(302, redirectAfterLogin);
		}

		const data = await parseRequestData(event.request);
		const token = data.token || event.url.searchParams.get("token");
		const otp = data.otp || data.code;
		const emailInput =
			data.email || event.url.searchParams.get("email") || "";
		const email = normalizeEmail(String(emailInput || ""));

		if (!token && !(otp && email)) {
			return jsonResponse({ ok: false, error: "Invalid magic link" }, 400);
		}

		let record = null;

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

		let user = null;
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

		let userId = user?.id ?? record.userId ?? null;

		if (onLogin) {
			const profile = {
				id: userId || record.email || email,
				email: record.email || email,
				name: user?.name || (record.email || email).split("@")[0],
			};
			const hookResult = await onLogin(event, profile, null, user);
			if (hookResult?.userId) userId = hookResult.userId;
			if (hookResult?.id) userId = hookResult.id;
			if (hookResult?.user?.id) userId = hookResult.user.id;
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

		return jsonResponse({ ok: true, user });
	};
}
