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

		const { hoursFrom, hoursTo, buffer, notice, capacity } = await request.json()
		const now = Date.now()

		// Save each setting
		const settings = [
			['hoursFrom', hoursFrom],
			['hoursTo', hoursTo],
			['buffer', String(buffer)],
			['notice', String(notice)],
			['capacity', String(capacity)]
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
		return json({ ok: false, error: { message: err.message } }, { status: 500 })
	}
}
