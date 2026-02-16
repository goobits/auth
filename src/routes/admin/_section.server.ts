import { actions as rootActions } from './+page.server'
import type { Actions, PageServerLoad } from './$types'
import type { AdminTabId } from '$lib/viewmodels/admin'

export const actions: Actions = rootActions as unknown as Actions

export function createAdminSectionLoad(initialTab: AdminTabId): PageServerLoad {
	return async (event) => {
		const locals = event.locals as { user?: Record<string, unknown> }
		return {
			user: locals.user ?? null,
			initialTab
		}
	}
}
