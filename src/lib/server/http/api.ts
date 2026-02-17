import { json } from '@sveltejs/kit'

export const noStoreHeaders = {
	'Cache-Control': 'no-store, max-age=0'
} as const

export function apiOk<T extends Record<string, unknown>>(body: T, status = 200) {
	return json({ ok: true, ...body }, { status, headers: noStoreHeaders })
}

export function apiError(
	message: string,
	input: { status?: number; code?: string; extra?: Record<string, unknown> } = {}
) {
	const { status = 500, code, extra } = input
	return json(
		{
			ok: false,
			error: {
				message,
				...(code ? { code } : {}),
				...(extra ?? {})
			}
		},
		{ status, headers: noStoreHeaders }
	)
}

export function apiValidationError(error: { message: string; status?: number }) {
	return apiError(error.message, { status: error.status ?? 400 })
}

export function logApiError(scope: string, error: unknown, meta: Record<string, unknown> = {}) {
	console.error(`[api] ${scope}`, { error, ...meta })
}
