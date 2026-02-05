import { json, type RequestEvent } from '@sveltejs/kit'
import { enforceSameOrigin, logAdminEvent, requireAdminSession, unauthorized, noStoreHeaders } from '../../../admin/_helpers.ts'
import { getAdminAuth } from '$lib/auth/admin.ts'
import { createInvite, deleteInvite, listInvites } from '@packages/calendar/src/calendar/invites.ts'

export async function GET(event: RequestEvent) {
	try {
		const auth = await requireAdminSession({ event })
		if (!auth.ok) return unauthorized()

		const { db } = await getAdminAuth({ event })
		const invites = await listInvites({ db })
		return json({ ok: true, invites }, { headers: noStoreHeaders })
	} catch (err) {
		console.error('Admin invites error:', err)
		return json({ ok: false, error: { message: 'Internal server error' } }, { status: 500, headers: noStoreHeaders })
	}
}

export async function POST(event: RequestEvent) {
	try {
		const csrf = enforceSameOrigin(event)
		if (csrf) return csrf

		const auth = await requireAdminSession({ event })
		if (!auth.ok) return unauthorized()

		const { db } = await getAdminAuth({ event })
		const body = await event.request.json().catch(() => ({}))
		const uses = Number.isFinite(Number(body?.uses)) ? Number(body.uses) : 1
		const expiresInDays = Number.isFinite(Number(body?.expiresInDays)) ? Number(body.expiresInDays) : null
		const expiresAt = expiresInDays
			? Math.floor(Date.now() / 1000) + (expiresInDays * 24 * 60 * 60)
			: null

		const invite = await createInvite({
			db,
			email: body?.email || null,
			usesRemaining: uses,
			expiresAt
		})

		logAdminEvent(event, 'invite_create', { inviteId: invite?.id, email: invite?.email ?? null })
		return json({ ok: true, invite }, { headers: noStoreHeaders })
	} catch (err) {
		console.error('Admin invite create error:', err)
		return json({ ok: false, error: { message: 'Internal server error' } }, { status: 500, headers: noStoreHeaders })
	}
}

export async function DELETE(event: RequestEvent) {
	try {
		const csrf = enforceSameOrigin(event)
		if (csrf) return csrf

		const auth = await requireAdminSession({ event })
		if (!auth.ok) return unauthorized()

		const inviteId = Number(event.url.searchParams.get('id'))
		if (!inviteId) {
			return json({ ok: false, error: { message: 'Missing invite id' } }, { status: 400, headers: noStoreHeaders })
		}

		const { db } = await getAdminAuth({ event })
		await deleteInvite({ db, inviteId })
		logAdminEvent(event, 'invite_delete', { inviteId })
		return json({ ok: true }, { headers: noStoreHeaders })
	} catch (err) {
		console.error('Admin invite delete error:', err)
		return json({ ok: false, error: { message: 'Internal server error' } }, { status: 500, headers: noStoreHeaders })
	}
}
