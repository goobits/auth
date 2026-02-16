import type { D1DatabaseLike } from '$lib/dev/devDb'
import type { CalendarProgramSlug } from '$lib/booking/programs'

type EventRow = {
	id: number
	activity_slug: string
	activity_label: string | null
	title: string
	starts_at: string
	ends_at: string
	capacity: number
	status: string
	location: string | null
	note: string | null
	cost_cents: number
	currency: string
	payment_provider: string | null
	payment_handle: string | null
	payment_note_template: string | null
	recap_text: string | null
	hero_image_url: string | null
}

type ParticipantRow = {
	event_id: number
	user_id: string
	guest_count: number
	status: string
	attendance_status: string
	note: string | null
	name: string | null
	avatar_url: string | null
	email: string | null
}

export type CalendarEventParticipant = {
	userId: string
	guestCount: number
	status: 'joined' | 'waitlist' | 'left'
	attendanceStatus: 'unknown' | 'attended' | 'flaked'
	note: string | null
	name: string | null
	avatarUrl: string | null
	email: string | null
}

export type CalendarFeedEvent = {
	id: number
	activitySlug: CalendarProgramSlug
	activityLabel: string
	title: string
	startsAt: string
	endsAt: string
	capacity: number
	seatsTaken: number
	seatsLeft: number
	waitlistCount: number
	userStatus: 'joined' | 'waitlist' | null
	userGuestCount: number
	location: string | null
	note: string | null
	costCents: number
	currency: string
	paymentProvider: string | null
	paymentHandle: string | null
	paymentNoteTemplate: string | null
	recapText: string | null
	heroImageUrl: string | null
	participants: Array<{ userId: string; name: string | null; avatarUrl: string | null }>
}

export type CalendarEventsFeed = {
	upcoming: CalendarFeedEvent[]
	recent: CalendarFeedEvent[]
}

export type CalendarProfile = {
	emergencyContact: string
	dietaryRestrictions: string
	chatHandle: string
}

async function listEventsByRange(
	db: D1DatabaseLike,
	userId: string,
	input: { onlyMine?: boolean; whereSql: string; bindValues?: unknown[]; limit?: number }
): Promise<CalendarFeedEvent[]> {
	const onlyMine = input.onlyMine ?? false
	const whereMine = onlyMine
		? `AND EXISTS (
			SELECT 1 FROM calendar_event_participants mine
			WHERE mine.event_id = e.id AND mine.user_id = ? AND mine.status IN ('joined', 'waitlist')
		)`
		: ''

	const eventResult = await db.prepare(
		`SELECT e.id, e.activity_slug, p.label AS activity_label, e.title, e.starts_at, e.ends_at, e.capacity, e.status, e.location, e.note,
		        e.cost_cents, e.currency, e.payment_provider, e.payment_handle, e.payment_note_template,
		        e.recap_text, e.hero_image_url
		 FROM calendar_events e
		 LEFT JOIN calendar_programs p ON p.slug = e.activity_slug
		 WHERE ${input.whereSql}
		   ${whereMine}
		 ORDER BY datetime(e.starts_at) ASC
		 LIMIT ?`
	).bind(...(input.bindValues ?? []), ...(onlyMine ? [userId] : []), input.limit ?? 60).all<EventRow>()

	const rows = eventResult?.results ?? []
	if (rows.length === 0) return []

	const eventIds = rows.map((row) => row.id)
	const placeholders = eventIds.map(() => '?').join(', ')
	const participantsResult = await db.prepare(
		`SELECT p.event_id, CAST(p.user_id AS TEXT) AS user_id, p.guest_count, p.status, p.attendance_status, p.note,
		        u.name, u.avatar_url, u.email
		 FROM calendar_event_participants p
		 LEFT JOIN calendar_users u ON CAST(u.id AS TEXT) = CAST(p.user_id AS TEXT)
		 WHERE p.event_id IN (${placeholders})
		 ORDER BY p.created_at ASC`
	).bind(...eventIds).all<ParticipantRow>()

	const byEvent = new Map<number, ParticipantRow[]>()
	for (const participant of (participantsResult?.results ?? [])) {
		const list = byEvent.get(participant.event_id) ?? []
		list.push(participant)
		byEvent.set(participant.event_id, list)
	}

	return rows.flatMap((row) => {
		const activitySlug = row.activity_slug as CalendarProgramSlug
		const participants = byEvent.get(row.id) ?? []
		const joined = participants.filter((participant) => participant.status === 'joined')
		const waitlist = participants.filter((participant) => participant.status === 'waitlist')
		const seatsTaken = joined.reduce((sum, participant) => sum + 1 + Math.max(0, participant.guest_count ?? 0), 0)
		const seatsLeft = Math.max(0, row.capacity - seatsTaken)
		const currentUser = participants.find((participant) => participant.user_id === userId)

		return [{
			id: row.id,
			activitySlug,
			activityLabel: row.activity_label || row.activity_slug,
			title: row.title,
			startsAt: row.starts_at,
			endsAt: row.ends_at,
			capacity: row.capacity,
			seatsTaken,
			seatsLeft,
			waitlistCount: waitlist.length,
			userStatus: currentUser?.status === 'joined' || currentUser?.status === 'waitlist' ? currentUser.status : null,
			userGuestCount: currentUser?.guest_count ?? 0,
			location: row.location,
			note: row.note,
			costCents: row.cost_cents ?? 0,
			currency: row.currency ?? 'USD',
			paymentProvider: row.payment_provider ?? null,
			paymentHandle: row.payment_handle ?? null,
			paymentNoteTemplate: row.payment_note_template ?? null,
			recapText: row.recap_text ?? null,
			heroImageUrl: row.hero_image_url ?? null,
			participants: joined.slice(0, 6).map((participant) => ({
				userId: participant.user_id,
				name: participant.name,
				avatarUrl: participant.avatar_url
			}))
		}]
	})
}

export async function listUpcomingEvents(db: D1DatabaseLike, userId: string, onlyMine = false): Promise<CalendarFeedEvent[]> {
	return listEventsByRange(db, userId, {
		onlyMine,
		whereSql: `e.status = 'scheduled' AND datetime(e.ends_at) >= datetime('now')`,
		limit: 60
	})
}

export async function listRecentEvents(db: D1DatabaseLike, userId: string, days = 7): Promise<CalendarFeedEvent[]> {
	return listEventsByRange(db, userId, {
		onlyMine: false,
		whereSql: `e.status = 'scheduled'
		  AND datetime(e.ends_at) < datetime('now')
		  AND datetime(e.ends_at) >= datetime('now', ?)`,
		bindValues: [`-${Math.max(1, Math.min(30, days))} days`],
		limit: 20
	})
}

export async function listEventsFeed(db: D1DatabaseLike, userId: string, onlyMine = false): Promise<CalendarEventsFeed> {
	const [upcoming, recent] = await Promise.all([
		listUpcomingEvents(db, userId, onlyMine),
		listRecentEvents(db, userId, 7)
	])
	return { upcoming, recent }
}

export async function createEventsBatch(
	db: D1DatabaseLike,
	input: {
		activitySlug: CalendarProgramSlug
		title: string
		startsAt: string
		endsAt: string
		capacity: number
		location?: string | null
		note?: string | null
		costCents?: number
		currency?: string
		paymentProvider?: string | null
		paymentHandle?: string | null
		paymentNoteTemplate?: string | null
		repeatWeeks?: number
		createdByUserId?: string | null
	}
) {
	const repeat = Math.max(0, Math.min(24, input.repeatWeeks ?? 0))
	const created: number[] = []
	for (let i = 0; i <= repeat; i++) {
		const start = new Date(input.startsAt)
		const end = new Date(input.endsAt)
		start.setUTCDate(start.getUTCDate() + i * 7)
		end.setUTCDate(end.getUTCDate() + i * 7)
		const result = await db.prepare(
			`INSERT INTO calendar_events (
			  activity_slug, title, starts_at, ends_at, capacity, location, note,
			  cost_cents, currency, payment_provider, payment_handle, payment_note_template,
			  created_by_user_id, created_at, updated_at
			 )
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())`
		)
			.bind(
				input.activitySlug,
				input.title,
				start.toISOString(),
				end.toISOString(),
				input.capacity,
				input.location ?? null,
				input.note ?? null,
				Math.max(0, input.costCents ?? 0),
				(input.currency || 'USD').slice(0, 8),
				input.paymentProvider ?? null,
				input.paymentHandle ?? null,
				input.paymentNoteTemplate ?? null,
				input.createdByUserId ?? null
			)
			.run()
		created.push(result.meta.last_row_id)
	}
	return created
}

async function getParticipant(db: D1DatabaseLike, eventId: number, userId: string) {
	return db.prepare(
		`SELECT id, guest_count, status FROM calendar_event_participants WHERE event_id = ? AND user_id = ? LIMIT 1`
	).bind(eventId, userId).first<{ id: number; guest_count: number; status: 'joined' | 'waitlist' | 'left' }>()
}

async function getEventCapacity(db: D1DatabaseLike, eventId: number) {
	const event = await db.prepare(
		`SELECT id, capacity FROM calendar_events WHERE id = ? AND status = 'scheduled' LIMIT 1`
	).bind(eventId).first<{ id: number; capacity: number }>()
	return event ?? null
}

async function getSeatsTaken(db: D1DatabaseLike, eventId: number) {
	const row = await db.prepare(
		`SELECT COALESCE(SUM(1 + guest_count), 0) AS seats_taken
		 FROM calendar_event_participants
		 WHERE event_id = ? AND status = 'joined'`
	).bind(eventId).first<{ seats_taken: number }>()
	return row?.seats_taken ?? 0
}

export async function joinEvent(
	db: D1DatabaseLike,
	input: { eventId: number; userId: string; guestCount: number; note?: string | null }
) {
	const event = await getEventCapacity(db, input.eventId)
	if (!event) return { ok: false as const, code: 'not_found', message: 'Event not found' }

	const guestCount = Math.max(0, Math.min(8, input.guestCount))
	const requestedSeats = 1 + guestCount
	const seatsTaken = await getSeatsTaken(db, input.eventId)
	const existing = await getParticipant(db, input.eventId, input.userId)
	const existingSeats = existing?.status === 'joined' ? 1 + (existing.guest_count ?? 0) : 0
	const seatsAfter = seatsTaken - existingSeats + requestedSeats
	const canJoin = seatsAfter <= event.capacity
	const status: 'joined' | 'waitlist' = canJoin ? 'joined' : 'waitlist'

	await db.prepare(
		`INSERT INTO calendar_event_participants (event_id, user_id, guest_count, status, attendance_status, note, created_at, updated_at)
		 VALUES (?, ?, ?, ?, 'unknown', ?, unixepoch(), unixepoch())
		 ON CONFLICT(event_id, user_id) DO UPDATE SET
		   guest_count = excluded.guest_count,
		   status = excluded.status,
		   note = excluded.note,
		   updated_at = unixepoch()`
	).bind(input.eventId, input.userId, guestCount, status, input.note ?? null).run()

	return {
		ok: true as const,
		status
	}
}

export async function leaveEvent(db: D1DatabaseLike, input: { eventId: number; userId: string }) {
	await db.prepare(
		`UPDATE calendar_event_participants
		 SET status = 'left', guest_count = 0, updated_at = unixepoch()
		 WHERE event_id = ? AND user_id = ?`
	).bind(input.eventId, input.userId).run()

	await bumpWaitlist(db, input.eventId)
	return { ok: true as const }
}

export async function bumpWaitlist(db: D1DatabaseLike, eventId: number) {
	const event = await getEventCapacity(db, eventId)
	if (!event) return

	let seatsTaken = await getSeatsTaken(db, eventId)
	const waitlistResult = await db.prepare(
		`SELECT user_id, guest_count
		 FROM calendar_event_participants
		 WHERE event_id = ? AND status = 'waitlist'
		 ORDER BY created_at ASC`
	).bind(eventId).all<{ user_id: string; guest_count: number }>()

	for (const row of (waitlistResult?.results ?? [])) {
		const seatsNeeded = 1 + Math.max(0, row.guest_count ?? 0)
		if (seatsTaken + seatsNeeded > event.capacity) continue

		await db.prepare(
			`UPDATE calendar_event_participants
			 SET status = 'joined', updated_at = unixepoch()
			 WHERE event_id = ? AND user_id = ?`
		).bind(eventId, row.user_id).run()
		seatsTaken += seatsNeeded
	}
}

export async function updateEventCapacity(db: D1DatabaseLike, input: { eventId: number; capacity: number }) {
	await db.prepare(
		`UPDATE calendar_events SET capacity = ?, updated_at = unixepoch() WHERE id = ?`
	).bind(input.capacity, input.eventId).run()
	await bumpWaitlist(db, input.eventId)
}

export async function setAttendanceStatus(
	db: D1DatabaseLike,
	input: { eventId: number; userId: string; attendanceStatus: 'unknown' | 'attended' | 'flaked' }
) {
	await db.prepare(
		`UPDATE calendar_event_participants
		 SET attendance_status = ?, updated_at = unixepoch()
		 WHERE event_id = ? AND user_id = ?`
	).bind(input.attendanceStatus, input.eventId, input.userId).run()
}

export async function updateEventMemory(db: D1DatabaseLike, input: {
	eventId: number
	recapText?: string | null
	heroImageUrl?: string | null
}) {
	await db.prepare(
		`UPDATE calendar_events
		 SET recap_text = ?, hero_image_url = ?, updated_at = unixepoch()
		 WHERE id = ?`
	).bind(input.recapText ?? null, input.heroImageUrl ?? null, input.eventId).run()
}

export async function getCalendarProfile(db: D1DatabaseLike, userId: string): Promise<CalendarProfile> {
	const row = await db.prepare(
		`SELECT emergency_contact, dietary_restrictions, chat_handle
		 FROM calendar_user_profiles WHERE user_id = ? LIMIT 1`
	).bind(userId).first<{ emergency_contact: string | null; dietary_restrictions: string | null; chat_handle: string | null }>()

	return {
		emergencyContact: row?.emergency_contact ?? '',
		dietaryRestrictions: row?.dietary_restrictions ?? '',
		chatHandle: row?.chat_handle ?? ''
	}
}

export async function saveCalendarProfile(db: D1DatabaseLike, userId: string, profile: CalendarProfile) {
	await db.prepare(
		`INSERT INTO calendar_user_profiles (user_id, emergency_contact, dietary_restrictions, chat_handle, updated_at)
		 VALUES (?, ?, ?, ?, unixepoch())
		 ON CONFLICT(user_id) DO UPDATE SET
		   emergency_contact = excluded.emergency_contact,
		   dietary_restrictions = excluded.dietary_restrictions,
		   chat_handle = excluded.chat_handle,
		   updated_at = unixepoch()`
	).bind(
		userId,
		profile.emergencyContact.trim() || null,
		profile.dietaryRestrictions.trim() || null,
		profile.chatHandle.trim() || null
	).run()
}
