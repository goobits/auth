import type { PageServerLoad } from './$types'
import type { AdminTabId } from '$lib/viewmodels/admin'

export function createAdminSectionLoad(initialTab: AdminTabId): PageServerLoad {
	return async (event) => {
		const locals = event.locals as { user?: Record<string, unknown> }
		return {
			user: locals.user ?? null,
			initialTab
		}
	}
}
