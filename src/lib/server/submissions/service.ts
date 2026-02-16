import { requireDb } from './db';
import { parseEmail, parseName, parseNotes, parseShort } from './validators';
import type { JoinSubmission, PlatformWithDb, ReminderSubmission, VolunteerSubmission } from './types';
import { raise } from '../http-error';

export async function saveJoin(platform: PlatformWithDb | undefined, form: FormData): Promise<void> {
	const db = requireDb(platform);
	const attendeesRaw = Number.parseInt(parseShort(form.get('attendees'), 2), 10);
	if (!Number.isFinite(attendeesRaw) || attendeesRaw < 1 || attendeesRaw > 20) {
		raise(400, 'Attendee count must be between 1 and 20.');
	}

	const payload: JoinSubmission = {
		name: parseName(form.get('name')),
		email: parseEmail(form.get('email')),
		attendees: attendeesRaw,
		routePreference: parseShort(form.get('routePreference')),
		notes: parseNotes(form.get('notes'))
	};

	await db
		.prepare(
			`INSERT INTO join_submissions (name, email, attendees, route_preference, notes)
       VALUES (?1, ?2, ?3, ?4, ?5)`
		)
		.bind(payload.name, payload.email, payload.attendees, payload.routePreference, payload.notes)
		.run();
}

export async function saveVolunteer(platform: PlatformWithDb | undefined, form: FormData): Promise<void> {
	const db = requireDb(platform);
	const payload: VolunteerSubmission = {
		name: parseName(form.get('name')),
		email: parseEmail(form.get('email')),
		rolePreference: parseShort(form.get('rolePreference')),
		availability: parseShort(form.get('availability')),
		notes: parseNotes(form.get('notes'))
	};

	await db
		.prepare(
			`INSERT INTO volunteer_submissions (name, email, role_preference, availability, notes)
       VALUES (?1, ?2, ?3, ?4, ?5)`
		)
		.bind(payload.name, payload.email, payload.rolePreference, payload.availability, payload.notes)
		.run();
}

export async function saveReminder(platform: PlatformWithDb | undefined, form: FormData): Promise<void> {
	const db = requireDb(platform);
	const payload: ReminderSubmission = {
		email: parseEmail(form.get('email'))
	};

	await db
		.prepare(
			`INSERT INTO reminder_submissions (email)
       VALUES (?1)
       ON CONFLICT(email) DO UPDATE SET updated_at = CURRENT_TIMESTAMP`
		)
		.bind(payload.email)
		.run();
}
