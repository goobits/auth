import { json } from '@sveltejs/kit'
import { buildEnv } from '../../calendar/_bridge.js'

export async function GET() {
	try {
		const env = buildEnv()
		const db = env.DB

		// Check if Google connection exists
		const connection = await db.prepare(
			`SELECT provider, expires_at FROM connections WHERE provider = 'google' LIMIT 1`
		).first()

		const connected = !!connection
		const expiresAt = connection?.expires_at || null
		const expired = expiresAt ? Date.now() > expiresAt : false

		// Get current rules from env
		const rules = {
			hoursFrom: env.BOOKING_HOURS_FROM || '06:00',
			hoursTo: env.BOOKING_HOURS_TO || '22:00',
			buffer: parseInt(env.BOOKING_BUFFER_MINUTES || '15', 10),
			notice: parseInt(env.BOOKING_MIN_NOTICE_HOURS || '24', 10),
			capacity: parseInt(env.BOOKING_CAPACITY || '4', 10)
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
