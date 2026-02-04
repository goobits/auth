const DEFAULT_COOLDOWN_MS = 10 * 60 * 1000;
const DEFAULT_MAX_PER_HOUR = 10;

export function createWebhookAlerter({
	url,
	secret = null,
	cooldownMs = DEFAULT_COOLDOWN_MS,
	maxPerHour = DEFAULT_MAX_PER_HOUR,
	timeoutMs = 5000,
} = {}) {
	const lastSent = new Map();
	const sentTimestamps = [];

	return async function sendAlert(payload, alertType = "security_alert") {
		if (!url) return false;

		const now = Date.now();
		const last = lastSent.get(alertType);
		if (last && now - last < cooldownMs) return false;

		const hourAgo = now - 60 * 60 * 1000;
		while (sentTimestamps.length && sentTimestamps[0] < hourAgo) {
			sentTimestamps.shift();
		}
		if (sentTimestamps.length >= maxPerHour) return false;

		const body = JSON.stringify({ alertType, timestamp: new Date().toISOString(), ...payload });
		const headers = { "Content-Type": "application/json" };

		if (secret) {
			const signature = await signPayload(body, secret);
			headers["X-Signature"] = signature;
		}

		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), timeoutMs);
		try {
			const response = await fetch(url, {
				method: "POST",
				headers,
				body,
				signal: controller.signal,
			});
			if (!response.ok) return false;
			lastSent.set(alertType, now);
			sentTimestamps.push(now);
			return true;
		} catch {
			return false;
		} finally {
			clearTimeout(timeout);
		}
	};
}

async function signPayload(body, secret) {
	if (globalThis.crypto?.subtle) {
		const key = await globalThis.crypto.subtle.importKey(
			"raw",
			new TextEncoder().encode(secret),
			{ name: "HMAC", hash: "SHA-256" },
			false,
			["sign"],
		);
		const sig = await globalThis.crypto.subtle.sign(
			"HMAC",
			key,
			new TextEncoder().encode(body),
		);
		return toHex(new Uint8Array(sig));
	}
	const { createHmac } = await import("node:crypto");
	return createHmac("sha256", secret).update(body).digest("hex");
}

function toHex(bytes) {
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}
