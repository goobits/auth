import { json, type RequestEvent } from '@sveltejs/kit'
import { noStoreHeaders } from '../_helpers.ts'

export async function GET(event: RequestEvent) {
	const locals = event.locals as {
		user?: { id?: string; email?: string; name?: string } | null
		session?: { id?: string } | null
	}

	const authenticated = !!(locals.session && locals.user)

	if (!authenticated) {
		return json({ ok: true, authenticated: false }, { headers: noStoreHeaders })
	}

	return json({
		ok: true,
		authenticated: true,
		user: {
			id: locals.user?.id || null,
			email: locals.user?.email || null,
			name: locals.user?.name || null
		}
	}, { headers: noStoreHeaders })
}
