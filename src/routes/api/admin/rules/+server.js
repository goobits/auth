import { json } from '@sveltejs/kit'
import { buildEnv } from '../../calendar/_bridge.js'
import { requireAdminSession, unauthorized } from '../_helpers.js'

export async function POST(event) {
	try {
		const env = await buildEnv(event.platform)
		const auth = await requireAdminSession({ event })
		if (!auth.ok) {
			return unauthorized()
		}
		const db = env.DB

		const body = await event.request.json().catch(() => null)
		if (!body) {
			return json({ ok: false, error: { message: 'Invalid JSON' } }, { status: 400 })
		}
		const { hoursFrom, hoursTo, buffer, notice, capacity } = body
		const now = Date.now()

		const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/
		if (!timePattern.test(String(hoursFrom)) || !timePattern.test(String(hoursTo))) {
			return json({ ok: false, error: { message: 'Invalid hours format' } }, { status: 400 })
		}

		const bufferValue = Number.parseInt(buffer, 10)
		const noticeValue = Number.parseInt(notice, 10)
		const capacityValue = Number.parseInt(capacity, 10)
		if (!Number.isFinite(bufferValue) || bufferValue < 0 || bufferValue > 180) {
			return json({ ok: false, error: { message: 'Invalid buffer' } }, { status: 400 })
		}
		if (!Number.isFinite(noticeValue) || noticeValue < 0 || noticeValue > 720) {
			return json({ ok: false, error: { message: 'Invalid notice' } }, { status: 400 })
		}
		if (!Number.isFinite(capacityValue) || capacityValue < 1 || capacityValue > 50) {
			return json({ ok: false, error: { message: 'Invalid capacity' } }, { status: 400 })
		}

		// Save each setting
		const settings = [
			['hoursFrom', hoursFrom],
			['hoursTo', hoursTo],
			['buffer', String(bufferValue)],
			['notice', String(noticeValue)],
			['capacity', String(capacityValue)]
		]

		for (const [key, value] of settings) {
			await db.prepare(
				`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
				 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
			).bind(key, value, now).run()
		}

		return json({ ok: true })
	} catch (err) {
		console.error('Admin rules save error:', err)
		return json({ ok: false, error: { message: 'Internal server error' } }, { status: 500 })
	}
}
