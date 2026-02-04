import { json } from '@sveltejs/kit'
import { requireAdminSession, unauthorized } from '../../../admin/_helpers.js'
import { getAdminAuth } from '$lib/auth/admin.js'
import { createInvite, deleteInvite, listInvites } from '@packages/calendar/src/calendar/invites.js'

export async function GET(event) {
	try {
		const auth = await requireAdminSession({ event })
		if (!auth.ok) return unauthorized()

		const { db } = await getAdminAuth({ event })
		const invites = await listInvites({ db })
		return json({ ok: true, invites })
	} catch (err) {
		console.error('Admin invites error:', err)
		return json({ ok: false, error: { message: 'Internal server error' } }, { status: 500 })
	}
}

export async function POST(event) {
	try {
		const auth = await requireAdminSession({ event })
		if (!auth.ok) return unauthorized()

		const { db } = await getAdminAuth({ event })
		const body = await event.request.json().catch(() => ({}))
		const uses = Number.isFinite(Number(body?.uses)) ? Number(body.uses) : 1
		const expiresInDays = Number.isFinite(Number(body?.expiresInDays)) ? Number(body.expiresInDays) : null
		const expiresAt = expiresInDays ? Math.floor(Date.now() / 1000) + (expiresInDays * 24 * 60 * 60) : null

		const invite = await createInvite({
			db,
			email: body?.email || null,
			usesRemaining: uses,
			expiresAt
		})

		return json({ ok: true, invite })
	} catch (err) {
		console.error('Admin invite create error:', err)
		return json({ ok: false, error: { message: 'Internal server error' } }, { status: 500 })
	}
}

export async function DELETE(event) {
	try {
		const auth = await requireAdminSession({ event })
		if (!auth.ok) return unauthorized()

		const inviteId = Number(event.url.searchParams.get('id'))
		if (!inviteId) {
			return json({ ok: false, error: { message: 'Missing invite id' } }, { status: 400 })
		}

		const { db } = await getAdminAuth({ event })
		await deleteInvite({ db, inviteId })
		return json({ ok: true })
	} catch (err) {
		console.error('Admin invite delete error:', err)
		return json({ ok: false, error: { message: 'Internal server error' } }, { status: 500 })
	}
}
