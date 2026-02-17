import { json, type RequestEvent } from '@sveltejs/kit'
import { buildEnv } from '../../calendar/_bridge.ts'

export async function POST(event: RequestEvent) {
	try {
		const expected = process.env['ADMIN_PASSCODE'] || ''
		if (!expected) {
			return json({ ok: false, error: { message: 'ADMIN_PASSCODE not configured' } }, { status: 500 })
		}

		const authHeader = event.request.headers.get('authorization') || ''
		const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : ''
		if (!token || token !== expected) {
			return json({ ok: false, error: { message: 'Unauthorized' } }, { status: 401 })
		}

		const env = await buildEnv(event.platform)
		const beforeEventsRow = await env.DB.prepare(
			`SELECT COUNT(*) AS count FROM calendar_events WHERE title LIKE 'E2E %'`
		).first<{ count: number }>()
		const beforeEvents = Number(beforeEventsRow?.count ?? 0)
		const beforeUsersRow = await env.DB.prepare(
			`SELECT COUNT(*) AS count
			 FROM calendar_users
			 WHERE lower(email) LIKE 'e2e-calendar-%@example.com'
			    OR name LIKE 'E2E Calendar User%'`
		).first<{ count: number }>()
		const beforeUsers = Number(beforeUsersRow?.count ?? 0)

		await env.DB.prepare(
			`DELETE FROM calendar_event_participants
			 WHERE event_id IN (SELECT id FROM calendar_events WHERE title LIKE 'E2E %')`
		).run()
		await env.DB.prepare(
			`DELETE FROM calendar_events WHERE title LIKE 'E2E %'`
		).run()

		// Remove test users and all related auth/profile/session rows.
		await env.DB.prepare(
			`DELETE FROM calendar_event_participants
			 WHERE user_id IN (
				SELECT CAST(id AS TEXT)
				FROM calendar_users
				WHERE lower(email) LIKE 'e2e-calendar-%@example.com'
				   OR name LIKE 'E2E Calendar User%'
			 )`
		).run()
		await env.DB.prepare(
			`DELETE FROM calendar_user_profiles
			 WHERE user_id IN (
				SELECT CAST(id AS TEXT)
				FROM calendar_users
				WHERE lower(email) LIKE 'e2e-calendar-%@example.com'
				   OR name LIKE 'E2E Calendar User%'
			 )`
		).run()
		await env.DB.prepare(
			`DELETE FROM calendar_email_verifications
			 WHERE user_id IN (
				SELECT CAST(id AS TEXT)
				FROM calendar_users
				WHERE lower(email) LIKE 'e2e-calendar-%@example.com'
				   OR name LIKE 'E2E Calendar User%'
			 )`
		).run()
		await env.DB.prepare(
			`DELETE FROM calendar_sessions
			 WHERE user_id IN (
				SELECT id
				FROM calendar_users
				WHERE lower(email) LIKE 'e2e-calendar-%@example.com'
				   OR name LIKE 'E2E Calendar User%'
			 )`
		).run()
		await env.DB.prepare(
			`DELETE FROM calendar_oauth_accounts
			 WHERE user_id IN (
				SELECT id
				FROM calendar_users
				WHERE lower(email) LIKE 'e2e-calendar-%@example.com'
				   OR name LIKE 'E2E Calendar User%'
			 )`
		).run()
		await env.DB.prepare(
			`DELETE FROM calendar_invite_redemptions
			 WHERE user_id IN (
				SELECT id
				FROM calendar_users
				WHERE lower(email) LIKE 'e2e-calendar-%@example.com'
				   OR name LIKE 'E2E Calendar User%'
			 )`
		).run()
		await env.DB.prepare(
			`DELETE FROM calendar_users
			 WHERE lower(email) LIKE 'e2e-calendar-%@example.com'
			    OR name LIKE 'E2E Calendar User%'`
		).run()

		const afterEventsRow = await env.DB.prepare(
			`SELECT COUNT(*) AS count FROM calendar_events WHERE title LIKE 'E2E %'`
		).first<{ count: number }>()
		const afterEvents = Number(afterEventsRow?.count ?? 0)
		const afterUsersRow = await env.DB.prepare(
			`SELECT COUNT(*) AS count
			 FROM calendar_users
			 WHERE lower(email) LIKE 'e2e-calendar-%@example.com'
			    OR name LIKE 'E2E Calendar User%'`
		).first<{ count: number }>()
		const afterUsers = Number(afterUsersRow?.count ?? 0)

		return json({
			ok: true,
			events: { before: beforeEvents, after: afterEvents },
			users: { before: beforeUsers, after: afterUsers }
		})
	} catch (error) {
		console.error('E2E calendar cleanup failed:', error)
		return json({ ok: false, error: { message: 'Internal server error' } }, { status: 500 })
	}
}
