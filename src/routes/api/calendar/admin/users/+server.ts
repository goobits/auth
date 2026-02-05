import { json, type RequestEvent } from '@sveltejs/kit'
import { requireAdminSession, unauthorized, noStoreHeaders } from '../../../admin/_helpers.ts'
import { getAdminAuth } from '$lib/auth/admin.ts'
import { listCalendarUsers } from '@packages/calendar/src/storage/d1.ts'

export async function GET(event: RequestEvent) {
	try {
		const auth = await requireAdminSession({ event })
		if (!auth.ok) return unauthorized()

		const { db } = await getAdminAuth({ event })
		const users = await listCalendarUsers({ db })
		type UserRow = { id: number; email: string; name: string; avatar_url: string | null; email_verified: number; last_login_at: number | null; provider: string | null }
		const sanitized = (users as UserRow[]).map(user => ({
			id: user.id,
			email: user.email,
			name: user.name,
			avatar_url: user.avatar_url,
			email_verified: user.email_verified,
			last_login_at: user.last_login_at,
			provider: user.provider
		}))
		return json({ ok: true, users: sanitized }, { headers: noStoreHeaders })
	} catch (err) {
		console.error('Admin users error:', err)
		return json({ ok: false, error: { message: 'Internal server error' } }, { status: 500, headers: noStoreHeaders })
	}
}
