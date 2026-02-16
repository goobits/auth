import { redirect } from '@sveltejs/kit'
import { actions as rootActions } from '../+page.server'
import { getAdminTabFromSegment } from '$lib/viewmodels/admin'
import type { Actions, PageServerLoad } from './$types'

export const actions: Actions = rootActions as unknown as Actions

export const load: PageServerLoad = async (event) => {
	const tab = getAdminTabFromSegment(event.params.tab || '')
	if (!tab) {
		throw redirect(302, '/admin')
	}

	const locals = event.locals as { user?: Record<string, unknown> }
	return {
		user: locals.user ?? null,
		initialTab: tab
	}
}
