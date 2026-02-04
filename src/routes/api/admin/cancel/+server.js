import { json } from '@sveltejs/kit'
import { buildEnv } from '../../calendar/_bridge.js'
import { requireAdminSession, unauthorized } from '../_helpers.js'
import { ensureValidGoogleToken, getConnection, cancelBookingAndEvents, saveConnection } from '../../../../../packages/calendar/src/index.js'
import { getTokenKey } from '../../../../../functions/api/calendar/_helpers.js'

export async function POST(event) {
	try {
		const env = await buildEnv(event.platform)
		const auth = await requireAdminSession({ event })
		if (!auth.ok) {
			return unauthorized()
		}
		const db = env.DB

		const { bookingId } = await event.request.json()
		if (!bookingId) {
			return json({ ok: false, error: { message: 'Missing bookingId' } }, { status: 400 })
		}

		const base64Key = getTokenKey(env)
		const connection = await getConnection({ db: env.DB, provider: 'google', base64Key })
		if (!connection) return json({ ok: false, error: { message: 'Google not connected' } }, { status: 400 })

		const token = await ensureValidGoogleToken({ env, token: connection })
		if (token.expiresAt !== connection.expiresAt) {
			await saveConnection({ db: env.DB, provider: 'google', token, base64Key })
		}

		await cancelBookingAndEvents({ db: env.DB, accessToken: token.accessToken, bookingId })

		return json({ ok: true })
	} catch (err) {
		console.error('Admin cancel error:', err)
		return json({ ok: false, error: { message: err.message } }, { status: 500 })
	}
}
