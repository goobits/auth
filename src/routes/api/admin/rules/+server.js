import { json } from '@sveltejs/kit'
import { buildEnv } from '../../calendar/_bridge.js'
import { requireAdminSession, unauthorized } from '../_helpers.js'

export async function POST({ request, platform }) {
	try {
		const env = await buildEnv(platform)
		const auth = await requireAdminSession({ env, request })
		if (!auth.ok) {
			return unauthorized()
		}
		const db = env.DB

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

		return json({ ok: true }, auth.setCookie ? { headers: { 'Set-Cookie': auth.setCookie } } : undefined)
	} catch (err) {
		console.error('Admin rules save error:', err)
		return json({ ok: false, error: { message: err.message } }, { status: 500 })
	}
}
