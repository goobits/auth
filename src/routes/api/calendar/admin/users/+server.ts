import type { RequestEvent } from '@sveltejs/kit'
import { requireAdminSession, unauthorized } from '../../../admin/_helpers.ts'
import { getAdminAuth } from '@miko/calendar-kit'
import { listCalendarUsers } from '@miko/calendar'
import { apiError, apiOk, logApiError } from '@miko/calendar-kit'

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
		return apiOk({ users: sanitized })
	} catch (err) {
		logApiError('admin.users.list', err)
		return apiError('Internal server error')
	}
}
