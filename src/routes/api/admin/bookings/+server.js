import { json } from '@sveltejs/kit'
import { buildEnv } from '../../calendar/_bridge.js'

export async function GET({ url, platform }) {
	try {
		const env = await buildEnv(platform)
		const db = env.DB

		// Get upcoming bookings (next 30 days by default)
		const now = new Date()
		const start = url.searchParams.get('start') || now.toISOString()
		const endDate = new Date(now)
		endDate.setDate(endDate.getDate() + 30)
		const end = url.searchParams.get('end') || endDate.toISOString()

		const res = await db.prepare(
			`SELECT id, start_at as start, end_at as end, timezone, seats, name, email, note, status, created_at
			 FROM bookings
			 WHERE status IN ('confirmed', 'pending')
			 AND start_at >= ?
			 ORDER BY start_at ASC`
		).bind(start).all()

		const bookings = (res?.results ?? []).map(row => ({
			id: row.id,
			date: formatDate(row.start),
			time: `${formatTime(row.start)} – ${formatTime(row.end)}`,
			start: row.start,
			end: row.end,
			timezone: row.timezone,
			seats: row.seats,
			name: row.name,
			email: row.email,
			note: row.note,
			status: row.status,
			createdAt: row.created_at
		}))

		const stats = {
			upcoming: bookings.length,
			seats: bookings.reduce((sum, b) => sum + (b.seats || 1), 0)
		}

		return json({ ok: true, bookings, stats })
	} catch (err) {
		console.error('Admin bookings error:', err)
		return json({ ok: false, error: { message: err.message } }, { status: 500 })
	}
}

function formatDate(isoString) {
	const date = new Date(isoString)
	return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatTime(isoString) {
	const date = new Date(isoString)
	return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}
