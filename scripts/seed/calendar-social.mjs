#!/usr/bin/env node
import path from 'node:path'
import fs from 'node:fs'
import Database from 'better-sqlite3'

const dbPath = path.join(process.cwd(), '.dev', 'db.sqlite')
const migrationsDir = path.join(process.cwd(), 'packages', 'calendar', 'migrations')
const db = new Database(dbPath)

const SEED_OWNER = 'seed-script'

function toIsoIn(daysOffset, hour, minute = 0, durationMinutes = 90) {
	const start = new Date()
	start.setUTCDate(start.getUTCDate() + daysOffset)
	start.setUTCHours(hour, minute, 0, 0)
	const end = new Date(start.getTime() + durationMinutes * 60 * 1000)
	return { startsAt: start.toISOString(), endsAt: end.toISOString() }
}

function runMigrations() {
	db.exec(`CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)`)
	const applied = new Set(
		db.prepare(`SELECT name FROM migrations`).all().map((row) => String(row.name))
	)
	const files = fs.readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort()
	const mark = db.prepare(`INSERT INTO migrations (name, applied_at) VALUES (?, unixepoch())`)
	const tx = db.transaction(() => {
		for (const file of files) {
			if (applied.has(file)) continue
			const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8')
			db.exec(sql)
			mark.run(file)
		}
	})
	tx()

	const hasEvents = db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'calendar_events'`).get()
	if (!hasEvents) {
		throw new Error('calendar events tables could not be migrated')
	}
}

function ensureUsers() {
	const users = [
		{ id: 9001, email: 'miko@example.com', name: 'Miko' },
		{ id: 9002, email: 'sarah@example.com', name: 'Sarah' },
		{ id: 9003, email: 'alex@example.com', name: 'Alex' },
		{ id: 9004, email: 'jamie@example.com', name: 'Jamie' },
		{ id: 9005, email: 'morgan@example.com', name: 'Morgan' }
	]
	const insert = db.prepare(
		`INSERT INTO calendar_users (id, email, name, created_at, last_login_at)
		 VALUES (?, ?, ?, unixepoch(), unixepoch())
		 ON CONFLICT(id) DO UPDATE SET name = excluded.name`
	)
	for (const user of users) insert.run(user.id, user.email, user.name)
}

function seedEvents() {
	db.prepare(`DELETE FROM calendar_event_participants WHERE event_id IN (SELECT id FROM calendar_events WHERE created_by_user_id = ?)`).run(SEED_OWNER)
	db.prepare(`DELETE FROM calendar_events WHERE created_by_user_id = ?`).run(SEED_OWNER)

	const events = [
		{
			activity: 'gym',
			title: 'Leg Day Crew',
			...toIsoIn(1, 18, 0, 75),
			capacity: 6,
			cost: 0
		},
		{
			activity: 'adventure',
			title: 'Forest Ridge Hike',
			...toIsoIn(3, 17, 30, 180),
			capacity: 4,
			cost: 1500,
			paymentProvider: 'venmo',
			paymentHandle: 'mudcube',
			paymentNote: 'Adventure ride + snacks'
		},
		{
			activity: 'movie-night',
			title: 'Studio Ghibli Night',
			...toIsoIn(5, 19, 0, 150),
			capacity: 8,
			cost: 700,
			paymentProvider: 'venmo',
			paymentHandle: 'mudcube',
			paymentNote: 'Movie snacks'
		},
		{
			activity: 'circus',
			title: 'Aerial Fundamentals',
			...toIsoIn(7, 18, 30, 120),
			capacity: 5,
			cost: 0
		},
		{
			activity: 'adventure',
			title: 'Coast Sunset Drive',
			...toIsoIn(-2, 16, 0, 240),
			capacity: 4,
			cost: 1200,
			paymentProvider: 'venmo',
			paymentHandle: 'mudcube',
			paymentNote: 'Gas split',
			recap: 'Caught the sunset at Cape Kiwanda and made tacos after.',
			image: '/media/super-racoon.svg'
		},
		{
			activity: 'gym',
			title: 'Mobility + Sauna',
			...toIsoIn(-5, 18, 0, 90),
			capacity: 6,
			cost: 0,
			recap: 'Great reset session. Everyone stayed for the cooldown stretch.',
			image: '/media/super-racoon.svg'
		}
	]

	const insertEvent = db.prepare(
		`INSERT INTO calendar_events (
		  activity_slug, title, starts_at, ends_at, capacity, status,
		  cost_cents, currency, payment_provider, payment_handle, payment_note_template,
		  recap_text, hero_image_url, created_by_user_id, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, 'scheduled', ?, 'USD', ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())`
	)

	const insertParticipant = db.prepare(
		`INSERT INTO calendar_event_participants (event_id, user_id, guest_count, status, attendance_status, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, unixepoch(), unixepoch())`
	)

	for (const event of events) {
		const res = insertEvent.run(
			event.activity,
			event.title,
			event.startsAt,
			event.endsAt,
			event.capacity,
			event.cost,
			event.paymentProvider ?? null,
			event.paymentHandle ?? null,
			event.paymentNote ?? null,
			event.recap ?? null,
			event.image ?? null,
			SEED_OWNER
		)
		const eventId = Number(res.lastInsertRowid)

		insertParticipant.run(eventId, '9001', 0, 'joined', 'unknown')
		insertParticipant.run(eventId, '9002', 0, 'joined', 'unknown')
		insertParticipant.run(eventId, '9003', event.activity === 'adventure' ? 1 : 0, 'joined', 'unknown')
		insertParticipant.run(eventId, '9004', 0, event.activity === 'adventure' ? 'waitlist' : 'joined', 'unknown')
	}
}

function run() {
	runMigrations()
	ensureUsers()
	seedEvents()
	console.log(`[seed:calendar] seeded social events into ${dbPath}`)
}

try {
	run()
} finally {
	db.close()
}
