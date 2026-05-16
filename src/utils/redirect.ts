export function isSafeRedirectPath(value: string): boolean {
	const v = value.trim();
	if (!v) return false;
	// Must be a relative path. Disallow protocol-relative, absolute URLs, and backslashes.
	if (!v.startsWith("/")) return false;
	if (v.startsWith("//")) return false;
	if (v.includes("\\")) return false;
	// Basic guard against newlines or control characters.
	if (/[\u0000-\u001f\u007f]/.test(v)) return false;
	return true;
}

export type SafeRedirectOptions = {
	allowedPrefixes?: readonly string[];
	baseUrl?: string;
};

export function normalizeSafeRedirectPath(
	value: unknown,
	options: SafeRedirectOptions = {},
): string | null {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	if (!isSafeRedirectPath(trimmed)) return null;

	let parsed: URL;
	try {
		parsed = new URL(trimmed, options.baseUrl ?? "https://auth.local");
	} catch {
		return null;
	}
	const pathname = parsed.pathname;
	const allowedPrefixes = options.allowedPrefixes ?? [];
	if (allowedPrefixes.length > 0) {
		const isAllowed = allowedPrefixes.some(
			(prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
		);
		if (!isAllowed) return null;
	}

	return `${pathname}${parsed.search}${parsed.hash}`;
}
