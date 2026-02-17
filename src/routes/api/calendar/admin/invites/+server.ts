import type { RequestEvent } from '@sveltejs/kit'
import { enforceSameOrigin, logAdminEvent, requireAdminSession, unauthorized } from '../../../admin/_helpers.ts'
import { getAdminAuth } from '$lib/auth/admin.ts'
import {
	createInvite,
	deleteInvite,
	listInvites,
	parseCalendarInviteCreateInput,
	TransportValidationError
} from '@miko/calendar'
import { apiOk, apiError, apiValidationError, logApiError } from '$lib/server/http/api'

export async function GET(event: RequestEvent) {
	try {
		const auth = await requireAdminSession({ event })
		if (!auth.ok) return unauthorized()

		const { db } = await getAdminAuth({ event })
		const invites = await listInvites({ db })
		return apiOk({ invites })
	} catch (err) {
		logApiError('admin.invites.list', err)
		return apiError('Internal server error')
	}
}

export async function POST(event: RequestEvent) {
	try {
		const csrf = enforceSameOrigin(event)
		if (csrf) return csrf

		const auth = await requireAdminSession({ event })
		if (!auth.ok) return unauthorized()

		const { db } = await getAdminAuth({ event })
		const input = parseCalendarInviteCreateInput(await event.request.json().catch(() => null))
		const uses = input.uses
		const expiresInDays = input.expiresInDays
		const expiresAt = expiresInDays
			? Math.floor(Date.now() / 1000) + (expiresInDays * 24 * 60 * 60)
			: null

		const invite = await createInvite({
			db,
			email: input.email,
			usesRemaining: uses,
			expiresAt
		})

		logAdminEvent(event, 'invite_create', { inviteId: invite?.id, email: invite?.email ?? null })
		return apiOk({ invite })
	} catch (err) {
		if (err instanceof TransportValidationError) {
			return apiValidationError(err)
		}
		logApiError('admin.invites.create', err)
		return apiError('Internal server error')
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
			return apiError('Missing invite id', { status: 400 })
		}

		const { db } = await getAdminAuth({ event })
		await deleteInvite({ db, inviteId })
		logAdminEvent(event, 'invite_delete', { inviteId })
		return apiOk({})
	} catch (err) {
		logApiError('admin.invites.delete', err)
		return apiError('Internal server error')
	}
}
