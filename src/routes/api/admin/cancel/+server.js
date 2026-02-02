import { json } from '@sveltejs/kit'
import { buildEnv } from '../../calendar/_bridge.js'

export async function POST({ request, url, platform }) {
	try {
		const env = await buildEnv(platform)
		const db = env.DB

		// Check admin auth
		const expectedCode = env.ADMIN_PASSCODE || ''
		if (expectedCode) {
			const code = url.searchParams.get('code') || ''
			if (code !== expectedCode) {
				return json({ ok: false, error: { message: 'Unauthorized' } }, { status: 401 })
			}
		}

		const { bookingId } = await request.json()
		if (!bookingId) {
			return json({ ok: false, error: { message: 'Missing bookingId' } }, { status: 400 })
		}

		// Update booking status to cancelled
		await db.prepare(
			`UPDATE bookings SET status = 'cancelled' WHERE id = ?`
		).bind(bookingId).run()

		return json({ ok: true })
	} catch (err) {
		console.error('Admin cancel error:', err)
		return json({ ok: false, error: { message: err.message } }, { status: 500 })
	}
}
