import { json } from '@sveltejs/kit'
import { buildEnv } from '../../calendar/_bridge.js'
import { requireAdminSession, unauthorized } from '../_helpers.js'

export async function GET(event) {
	try {
		const env = await buildEnv(event.platform)
		const auth = await requireAdminSession({ event })
		if (!auth.ok) {
			return unauthorized()
		}
		const db = env.DB

		// Check if Google connection exists
		const connection = await db.prepare(
			`SELECT provider, expires_at FROM connections WHERE provider = 'google' LIMIT 1`
		).first()

		const connected = !!connection
		const expiresAt = connection?.expires_at || null
		const expired = expiresAt ? Date.now() > expiresAt : false

		// Get current rules from settings table, fallback to env
		const settingsRes = await db.prepare(
			`SELECT key, value FROM settings WHERE key IN ('hoursFrom', 'hoursTo', 'buffer', 'notice', 'capacity')`
		).all()

		const settings = {}
		for (const row of settingsRes?.results || []) {
			settings[row.key] = row.value
		}

		const rules = {
			hoursFrom: settings.hoursFrom || env.BOOKING_HOURS_FROM || '06:00',
			hoursTo: settings.hoursTo || env.BOOKING_HOURS_TO || '22:00',
			buffer: parseInt(settings.buffer || env.BOOKING_BUFFER_MINUTES || '15', 10),
			notice: parseInt(settings.notice || env.BOOKING_MIN_NOTICE_HOURS || '24', 10),
			capacity: parseInt(settings.capacity || env.BOOKING_CAPACITY || '4', 10)
		}

		return json({
			ok: true,
			google: {
				connected,
				expired,
				expiresAt
			},
			rules
		})
	} catch (err) {
		console.error('Admin status error:', err)
		return json({ ok: false, error: { message: err.message } }, { status: 500 })
	}
}
