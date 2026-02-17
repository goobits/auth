import type { RequestEvent } from '@sveltejs/kit'
import { buildEnv } from '../../calendar/_bridge.ts'
import { ensureValidGoogleToken, getConnection, saveConnection, requireEnv, getCalendarSyncQueueHealth } from '@miko/calendar'
import { requireAdminSession, unauthorized } from '../_helpers.ts'
import { apiError, apiOk, logApiError } from '$lib/server/http/api'

export async function GET(event: RequestEvent) {
	try {
		const env = await buildEnv(event.platform)
		const auth = await requireAdminSession({ event })
		if (!auth.ok) {
			return unauthorized()
		}
		const db = env.DB

		let connected = false
		let expired = false
		let refreshFailed = false
		let expiresAt: number | null = null

		const base64Key = requireEnv(env, 'TOKEN_ENC_KEY')
		const connection = await getConnection({ db, provider: 'google', base64Key })
		if (connection) {
			connected = true
			expiresAt = connection.expiresAt ?? null
			expired = !expiresAt || Date.now() > expiresAt

			// Access tokens are short-lived; attempt refresh before flagging broken state.
			if (expired) {
				try {
					const next = await ensureValidGoogleToken({ env, token: connection })
					if (next.expiresAt !== connection.expiresAt || next.accessToken !== connection.accessToken) {
						await saveConnection({ db, provider: 'google', token: next, base64Key })
					}
					expiresAt = next.expiresAt ?? null
					expired = !expiresAt || Date.now() > expiresAt
				} catch (error) {
					refreshFailed = true
					console.warn('Google token refresh check failed in admin status:', error)
				}
			}
		}

		// Get current rules from settings table, fallback to env
		const settingsRes = await db.prepare(
			`SELECT key, value FROM settings WHERE key IN ('hoursFrom', 'hoursTo', 'buffer', 'notice', 'capacity')`
		).all()

		const settings: Record<string, string> = {}
		for (const row of (settingsRes?.results ?? []) as Array<{ key: string; value: string }>) {
			settings[row.key] = row.value
		}
		const envValue = (key: string, fallback: string) => {
			const raw = env[key]
			return typeof raw === 'string' ? raw : fallback
		}

		const rules = {
			hoursFrom: settings['hoursFrom'] || envValue('BOOKING_HOURS_FROM', '06:00'),
			hoursTo: settings['hoursTo'] || envValue('BOOKING_HOURS_TO', '22:00'),
			buffer: parseInt(settings['buffer'] || envValue('BOOKING_BUFFER_MINUTES', '15'), 10),
			notice: parseInt(settings['notice'] || envValue('BOOKING_MIN_NOTICE_HOURS', '24'), 10),
			capacity: parseInt(settings['capacity'] || envValue('BOOKING_CAPACITY', '4'), 10)
		}
		const syncQueue = await getCalendarSyncQueueHealth(db)

		return apiOk({
			google: {
				connected,
				expired,
				expiresAt,
				refreshFailed
			},
			syncQueue,
			rules
		})
	} catch (err) {
		logApiError('admin.status', err)
		return apiError('Internal server error')
	}
}
