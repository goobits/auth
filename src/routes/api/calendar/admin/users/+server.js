import { json } from '@sveltejs/kit'
import { requireAdminSession, unauthorized } from '../../../admin/_helpers.js'
import { getAdminAuth } from '$lib/auth/admin.js'
import { listCalendarUsers } from '@packages/calendar/src/storage/d1.js'

export async function GET(event) {
	try {
		const auth = await requireAdminSession({ event })
		if (!auth.ok) return unauthorized()

		const { db } = await getAdminAuth({ event })
		const users = await listCalendarUsers({ db })
		const sanitized = users.map(user => ({
			id: user.id,
			email: user.email,
			name: user.name,
			avatar_url: user.avatar_url,
			email_verified: user.email_verified,
			last_login_at: user.last_login_at,
			provider: user.provider
		}))
		return json({ ok: true, users: sanitized })
	} catch (err) {
		console.error('Admin users error:', err)
		return json({ ok: false, error: { message: 'Internal server error' } }, { status: 500 })
	}
}
