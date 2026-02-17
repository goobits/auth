import { z } from "zod";

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

export async function parseRequestDataWithSchema<T extends z.ZodTypeAny>(
	request: Request,
	schema: T,
): Promise<z.infer<T> | null> {
	const data = await parseRequestData(request);
	const parsed = schema.safeParse(data);
	if (!parsed.success) return null;
	return parsed.data;
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
