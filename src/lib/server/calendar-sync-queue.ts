import type { D1DatabaseLike } from '$lib/dev/devDb'
import { ensureValidGoogleToken, getConnection, googleCreateEvent, googleDeleteEvent, saveConnection } from '@packages/calendar/src/index.ts'
import { getEnv } from '@packages/calendar/src/config/env.ts'

type SyncJobRow = {
	id: number
	event_id: number
	trigger: string
	requested_by_user_id: string | null
	payload_json: string | null
	status: 'pending' | 'processing' | 'done' | 'failed'
	attempt_count: number
}

type EventForSync = {
	id: number
	title: string
	starts_at: string
	ends_at: string
	capacity: number
	location: string | null
	note: string | null
}

type JobQueueHealth = {
	pending: number
	processing: number
	failed: number
	oldestPendingSeconds: number
}

function getPrimaryCalendarIdFromEnv(env: Record<string, unknown>) {
	const primary = getEnv(env, 'GOOGLE_PRIMARY_CALENDAR_ID', '')?.trim()
	if (primary) return primary
	const ids = getEnv(env, 'GOOGLE_CALENDAR_IDS', '') || ''
	return ids.split(',').map((id) => id.trim()).filter(Boolean)[0] || ''
}

function nextBackoffSeconds(attemptCount: number) {
	const base = 30
	const expo = Math.min(8, Math.max(0, attemptCount - 1))
	return Math.min(3600, base * (2 ** expo))
}

export async function enqueueCalendarSyncJob(
	db: D1DatabaseLike,
	input: { eventId: number; trigger: string; requestedByUserId?: string | null; payload?: Record<string, unknown> | null }
) {
	await db.prepare(
		`INSERT INTO calendar_sync_jobs (
		  event_id, trigger, requested_by_user_id, payload_json, status, attempt_count, next_attempt_at, created_at, updated_at
		) VALUES (?, ?, ?, ?, 'pending', 0, unixepoch(), unixepoch(), unixepoch())`
	)
		.bind(
			input.eventId,
			input.trigger,
			input.requestedByUserId ?? null,
			input.payload ? JSON.stringify(input.payload) : null
		)
		.run()
}

export async function getCalendarSyncQueueHealth(db: D1DatabaseLike): Promise<JobQueueHealth> {
	try {
		const counts = await db.prepare(
			`SELECT
				COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS pending,
				COALESCE(SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END), 0) AS processing,
				COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) AS failed
			FROM calendar_sync_jobs`
		).first<{ pending: number; processing: number; failed: number }>()

		const oldestPending = await db.prepare(
			`SELECT created_at FROM calendar_sync_jobs WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1`
		).first<{ created_at: number }>()

		const now = Math.floor(Date.now() / 1000)
		return {
			pending: counts?.pending ?? 0,
			processing: counts?.processing ?? 0,
			failed: counts?.failed ?? 0,
			oldestPendingSeconds: oldestPending?.created_at ? Math.max(0, now - oldestPending.created_at) : 0
		}
	} catch {
		return { pending: 0, processing: 0, failed: 0, oldestPendingSeconds: 0 }
	}
}

async function claimDueJobs(db: D1DatabaseLike, limit = 10) {
	const result = await db.prepare(
		`SELECT id, event_id, trigger, requested_by_user_id, payload_json, status, attempt_count
		 FROM calendar_sync_jobs
		 WHERE status IN ('pending', 'failed')
		   AND next_attempt_at <= unixepoch()
		 ORDER BY id ASC
		 LIMIT ?`
	).bind(limit).all<SyncJobRow>()
	const jobs = result?.results ?? []
	const claimed: SyncJobRow[] = []
	for (const job of jobs) {
		const lock = await db.prepare(
			`UPDATE calendar_sync_jobs
			 SET status = 'processing', locked_at = unixepoch(), locked_by = ?, updated_at = unixepoch()
			 WHERE id = ? AND status IN ('pending', 'failed')`
		).bind('admin-sync-worker', job.id).run()
		if ((lock.meta?.changes ?? 0) > 0) claimed.push(job)
	}
	return claimed
}

async function markJobDone(db: D1DatabaseLike, id: number) {
	await db.prepare(
		`UPDATE calendar_sync_jobs
		 SET status = 'done', last_error = NULL, updated_at = unixepoch(), locked_at = NULL, locked_by = NULL
		 WHERE id = ?`
	).bind(id).run()
}

async function markJobRetry(db: D1DatabaseLike, id: number, attemptCount: number, errorMessage: string) {
	const backoff = nextBackoffSeconds(attemptCount)
	await db.prepare(
		`UPDATE calendar_sync_jobs
		 SET status = 'failed',
		     attempt_count = ?,
		     next_attempt_at = unixepoch() + ?,
		     last_error = ?,
		     updated_at = unixepoch(),
		     locked_at = NULL,
		     locked_by = NULL
		 WHERE id = ?`
	).bind(attemptCount, backoff, errorMessage.slice(0, 400), id).run()
}

async function fetchEventForSync(db: D1DatabaseLike, eventId: number) {
	return db.prepare(
		`SELECT id, title, starts_at, ends_at, capacity, location, note
		 FROM calendar_events
		 WHERE id = ? LIMIT 1`
	).bind(eventId).first<EventForSync>()
}

async function fetchSeatSummary(db: D1DatabaseLike, eventId: number) {
	return db.prepare(
		`SELECT
			COALESCE(SUM(CASE WHEN status = 'joined' THEN 1 + guest_count ELSE 0 END), 0) AS seats_taken,
			COALESCE(SUM(CASE WHEN status = 'waitlist' THEN 1 ELSE 0 END), 0) AS waitlist_count
		 FROM calendar_event_participants
		 WHERE event_id = ?`
	).bind(eventId).first<{ seats_taken: number; waitlist_count: number }>()
}

async function upsertCalendarEventSync(
	db: D1DatabaseLike,
	input: { eventId: number; googleEventId: string; googleHtmlLink: string | null; lastError?: string | null }
) {
	await db.prepare(
		`INSERT INTO calendar_event_sync (event_id, google_event_id, google_html_link, last_synced_at, last_error, updated_at)
		 VALUES (?, ?, ?, unixepoch(), ?, unixepoch())
		 ON CONFLICT(event_id) DO UPDATE SET
		   google_event_id = excluded.google_event_id,
		   google_html_link = excluded.google_html_link,
		   last_synced_at = excluded.last_synced_at,
		   last_error = excluded.last_error,
		   updated_at = unixepoch()`
	).bind(input.eventId, input.googleEventId, input.googleHtmlLink, input.lastError ?? null).run()
}

async function getPreviousGoogleEventId(db: D1DatabaseLike, eventId: number) {
	const row = await db.prepare(
		`SELECT google_event_id FROM calendar_event_sync WHERE event_id = ? LIMIT 1`
	).bind(eventId).first<{ google_event_id: string | null }>()
	return row?.google_event_id ?? null
}

async function processSingleJob(
	db: D1DatabaseLike,
	env: Record<string, unknown>,
	job: SyncJobRow
) {
	const event = await fetchEventForSync(db, job.event_id)
	if (!event) {
		// Event deleted; job can be marked done.
		await markJobDone(db, job.id)
		return
	}

	const base64Key = String(getEnv(env, 'TOKEN_ENC_KEY', '') || '')
	if (!base64Key) throw new Error('Missing TOKEN_ENC_KEY')

	const calendarId = getPrimaryCalendarIdFromEnv(env)
	if (!calendarId) throw new Error('Missing GOOGLE_PRIMARY_CALENDAR_ID/GOOGLE_CALENDAR_IDS')

	const connection = await getConnection({ db, provider: 'google', base64Key })
	if (!connection) throw new Error('Google calendar connection not found')

	const token = await ensureValidGoogleToken({ env, token: connection })
	if (token.expiresAt !== connection.expiresAt || token.accessToken !== connection.accessToken) {
		await saveConnection({ db, provider: 'google', token, base64Key })
	}

	const summary = await fetchSeatSummary(db, job.event_id)
	const seatsTaken = summary?.seats_taken ?? 0
	const waitlist = summary?.waitlist_count ?? 0
	const descriptionLines = [
		`Program event sync`,
		`Seats: ${seatsTaken}/${event.capacity}`,
		waitlist > 0 ? `Waitlist: ${waitlist}` : '',
		event.note ? `Note: ${event.note}` : ''
	].filter(Boolean)

	const oldGoogleEventId = await getPreviousGoogleEventId(db, job.event_id)
	if (oldGoogleEventId) {
		await googleDeleteEvent({
			accessToken: token.accessToken,
			calendarId,
			eventId: oldGoogleEventId
		})
	}

	const created = await googleCreateEvent({
		accessToken: token.accessToken,
		calendarId,
		event: {
			summary: `${event.title} (${seatsTaken}/${event.capacity})`,
			description: descriptionLines.join('\n'),
			start: { dateTime: event.starts_at, timeZone: 'UTC' },
			end: { dateTime: event.ends_at, timeZone: 'UTC' },
			...(event.location ? { location: event.location } : {})
		}
	})

	await upsertCalendarEventSync(db, {
		eventId: job.event_id,
		googleEventId: created.id,
		googleHtmlLink: created.htmlLink ?? null,
		lastError: null
	})
	await markJobDone(db, job.id)
}

export async function processCalendarSyncQueue(
	db: D1DatabaseLike,
	env: Record<string, unknown>,
	limit = 10
) {
	const jobs = await claimDueJobs(db, limit)
	let processed = 0
	let failed = 0

	for (const job of jobs) {
		try {
			await processSingleJob(db, env, job)
			processed += 1
		} catch (error) {
			failed += 1
			const nextAttempt = (job.attempt_count ?? 0) + 1
			const message = error instanceof Error ? error.message : 'Unknown sync error'
			await markJobRetry(db, job.id, nextAttempt, message)
		}
	}

	return { claimed: jobs.length, processed, failed }
}
