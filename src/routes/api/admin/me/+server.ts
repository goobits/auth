import type { RequestEvent } from '@sveltejs/kit'
import { apiOk } from '@miko/calendar-kit'

export async function GET(event: RequestEvent) {
	const locals = event.locals as {
		user?: { id?: string; email?: string; name?: string } | null
		session?: { id?: string } | null
	}

	const authenticated = !!(locals.session && locals.user)

	if (!authenticated) {
		return apiOk({ authenticated: false })
	}

	return apiOk({
		authenticated: true,
		user: {
			id: locals.user?.id || null,
			email: locals.user?.email || null,
			name: locals.user?.name || null
		}
	})
}
