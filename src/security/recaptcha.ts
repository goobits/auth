const DEFAULT_TIMEOUT_MS = 5000;

type RecaptchaOptions = {
	secretKey?: string;
	action?: string | null;
	minScore?: number;
	timeoutMs?: number;
	allowInDevelopment?: boolean;
};

type RecaptchaResponse = {
	success?: boolean;
	score?: number;
	action?: string;
};

export async function verifyRecaptchaToken(
	token: string | null,
	options: RecaptchaOptions = {},
): Promise<boolean> {
	const {
		secretKey = process.env["RECAPTCHA_SECRET_KEY"],
		action = null,
		minScore = 0.5,
		timeoutMs = DEFAULT_TIMEOUT_MS,
		allowInDevelopment = true,
	} = options;

	if (!token) return false;
	if (!secretKey) {
		return process.env["NODE_ENV"] === "production" ? false : allowInDevelopment;
	}

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);

	try {
		const response = await fetch(
			"https://www.google.com/recaptcha/api/siteverify",
			{
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({ secret: secretKey, response: token }),
				signal: controller.signal,
			},
		);

		if (!response.ok) return false;
		const data = (await response.json()) as RecaptchaResponse;

		if (!data.success) return false;

		if (typeof data.score === "number") {
			if (data.score < minScore) return false;
			if (action && data.action !== action) return false;
		}

		return true;
	} catch {
		return false;
	} finally {
		clearTimeout(timeout);
	}
}
