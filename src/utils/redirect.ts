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

