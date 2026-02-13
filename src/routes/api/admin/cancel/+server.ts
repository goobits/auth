import { json, type RequestEvent } from '@sveltejs/kit'
import { buildEnv } from '../../calendar/_bridge.ts'
import { enforceSameOrigin, logAdminEvent, requireAdminSession, unauthorized, noStoreHeaders } from '../_helpers.ts'
import { ensureValidGoogleToken, getConnection, cancelBookingAndEvents, saveConnection } from '../../../../../packages/calendar/src/index.ts'
import { getTokenKey } from '../../../../../functions/api/calendar/_helpers.ts'

export async function POST(event: RequestEvent) {
	try {
		const csrf = enforceSameOrigin(event)
		if (csrf) return csrf

		const env = await buildEnv(event.platform)
		const auth = await requireAdminSession({ event })
		if (!auth.ok) {
			return unauthorized()
		}

		const body = await event.request.json().catch(() => null)
		if (!body) {
			return json({ ok: false, error: { message: 'Invalid JSON' } }, { status: 400, headers: noStoreHeaders })
		}
		const { bookingId } = body
		if (!bookingId) {
			return json({ ok: false, error: { message: 'Missing bookingId' } }, { status: 400, headers: noStoreHeaders })
		}

		const base64Key = getTokenKey(env)
		const connection = await getConnection({ db: env.DB, provider: 'google', base64Key })
		if (!connection) return json({ ok: false, error: { message: 'Google not connected' } }, { status: 400, headers: noStoreHeaders })

		const token = await ensureValidGoogleToken({ env, token: connection })
		if (token.expiresAt !== connection.expiresAt) {
			await saveConnection({ db: env.DB, provider: 'google', token, base64Key })
		}

		await cancelBookingAndEvents({ db: env.DB, accessToken: token.accessToken, bookingId })

		logAdminEvent(event, 'booking_cancel', { bookingId })
		return json({ ok: true }, { headers: noStoreHeaders })
	} catch (err) {
		console.error('Admin cancel error:', err)
		return json({ ok: false, error: { message: 'Internal server error' } }, { status: 500, headers: noStoreHeaders })
	}
}
