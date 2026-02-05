import { json, type RequestEvent } from '@sveltejs/kit'
import { buildEnv } from '../../calendar/_bridge.ts'
import { requireAdminSession, unauthorized, noStoreHeaders } from '../_helpers.ts'

export async function GET(event: RequestEvent) {
	try {
		const env = await buildEnv(event.platform)
		const auth = await requireAdminSession({ event })
		if (!auth.ok) {
			return unauthorized()
		}
		const db = env.DB

		// Get upcoming bookings (next 30 days by default)
		const now = new Date()
		const endDate = new Date(now)
		endDate.setDate(endDate.getDate() + 30)

		const rawStart = event.url.searchParams.get('start')
		const rawEnd = event.url.searchParams.get('end')
		const start = rawStart && Number.isFinite(Date.parse(rawStart)) ? rawStart : now.toISOString()
		const end = rawEnd && Number.isFinite(Date.parse(rawEnd)) ? rawEnd : endDate.toISOString()

		const res = await db.prepare(
			`SELECT id, start_at as start, end_at as end, timezone, seats, name, email, note, status, created_at
			 FROM bookings
			 WHERE status IN ('confirmed', 'pending')
			 AND start_at >= ?
			 AND start_at <= ?
			 ORDER BY start_at ASC`
		).bind(start, end).all()

		type BookingRow = { id: number; start: string; end: string; timezone: string; seats: number | null; name: string; email: string; note: string | null; status: string; created_at: number }
		const bookings = ((res?.results ?? []) as BookingRow[]).map(row => ({
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

		return json({ ok: true, bookings, stats }, { headers: noStoreHeaders })
	} catch (err) {
		console.error('Admin bookings error:', err)
		return json({ ok: false, error: { message: 'Internal server error' } }, { status: 500, headers: noStoreHeaders })
	}
}

function formatDate(isoString: string) {
	const date = new Date(isoString)
	return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatTime(isoString: string) {
	const date = new Date(isoString)
	return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}
