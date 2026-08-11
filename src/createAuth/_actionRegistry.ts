import { fail } from '@sveltejs/kit'

import type { AuthActions, AuthHandlers, RequestEventLike } from '../types/auth.ts'

async function readActionResponse(response: Response): Promise<Record<string, unknown>> {
	if (response.status === 204) return { ok: true }

	const contentType = response.headers.get('content-type') ?? ''
	if (contentType.includes('application/json')) {
		const data: unknown = await response.json()
		return data && typeof data === 'object' && !Array.isArray(data)
			? (data as Record<string, unknown>)
			: { data }
	}

	const message = await response.text()
	return message ? { message } : { ok: response.ok }
}

/** Builds SvelteKit form actions from secured auth request handlers. */
export function buildActions(handlers: AuthHandlers): AuthActions {
	return {
		logout: () => ({
			default: async (event) => {
				const response = await handlers.logout(event as unknown as RequestEventLike)
				const data = await readActionResponse(response)
				return response.ok ? data : fail(response.status, data)
			}
		})
	}
}
