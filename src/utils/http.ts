export async function parseRequestData(
	request: Request,
): Promise<Record<string, unknown>> {
	const contentType = request.headers.get("content-type") || "";
	if (contentType.includes("application/json")) {
		const data = await request.json().catch(() => ({}));
		if (!data || typeof data !== "object") return {};
		return data as Record<string, unknown>;
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

export function jsonResponse(
	payload: unknown,
	status: number = 200,
): Response {
	return new Response(JSON.stringify(payload), {
		status,
		headers: { "content-type": "application/json" },
	});
}
