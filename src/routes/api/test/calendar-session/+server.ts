import { json, type RequestEvent } from '@sveltejs/kit'
import { D1SessionAdapter } from '@goobits/auth/adapters'
import { buildEnv } from '@miko/calendar-kit'
import { parseCalendarSessionBootstrapInput, TransportValidationError } from '@miko/calendar'

type CalendarUserRow = { id: string | number }

function unauthorized() {
	return json({ ok: false, error: { message: 'Unauthorized' } }, { status: 401 })
}

export async function POST(event: RequestEvent) {
	try {
		const env = await buildEnv(event.platform)
		if (env['NODE_ENV'] !== 'development') return unauthorized()
		if (env['E2E_RUN'] !== '1') return unauthorized()

		const expected = String(env['E2E_TEST_TOKEN'] || env['ADMIN_PASSCODE'] || '')
		if (!expected) return unauthorized()
		const authHeader = event.request.headers.get('authorization') || ''
		const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : ''
		if (!token || token !== expected) return unauthorized()

		const { email, name } = parseCalendarSessionBootstrapInput(await event.request.json().catch(() => null))

		const existing = await env.DB.prepare(
			`SELECT id FROM calendar_users WHERE lower(email) = lower(?) LIMIT 1`
		).bind(email).first<CalendarUserRow>()
		let userId = existing?.id
		if (!userId) {
			const inserted = await env.DB.prepare(
				`INSERT INTO calendar_users (email, name, email_verified, created_at, last_login_at)
				 VALUES (?, ?, 1, unixepoch(), unixepoch())`
			).bind(email, name).run()
			userId = inserted.meta.last_row_id
		} else {
			await env.DB.prepare(
				`UPDATE calendar_users SET last_login_at = unixepoch() WHERE id = ?`
			).bind(userId).run()
		}

		const secureCookies = env['NODE_ENV'] !== 'development'
		const sessionAdapter = new D1SessionAdapter(env.DB, {
			sessionsTable: 'calendar_sessions',
			usersTable: 'calendar_users',
			cookieName: 'calendar_session',
			secureCookies,
			sessionLifetime: 7 * 24 * 60 * 60 * 1000,
			userColumns: {
				id: 'id',
				email: 'email',
				name: 'name',
				avatar: 'avatar_url',
				password: 'password',
				emailVerified: 'email_verified'
			}
		})

		const session = await sessionAdapter.createSession(String(userId))
		sessionAdapter.setSessionCookie(event.cookies, session)

		return json({ ok: true, email, userId: String(userId) })
	} catch (error) {
		if (error instanceof TransportValidationError) {
			return json({ ok: false, error: { message: error.message } }, { status: error.status })
		}
		console.error('E2E calendar session bootstrap failed:', error)
		return json({ ok: false, error: { message: 'Internal server error' } }, { status: 500 })
	}
}
