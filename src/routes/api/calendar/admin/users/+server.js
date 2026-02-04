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
		return json({ ok: true, users })
	} catch (err) {
		console.error('Admin users error:', err)
		return json({ ok: false, error: { message: err.message } }, { status: 500 })
	}
}
