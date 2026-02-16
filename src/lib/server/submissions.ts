import { error } from '@sveltejs/kit';

export type JoinSubmission = {
	name: string;
	email: string;
	attendees: number;
	routePreference: string;
	notes: string;
};

export type VolunteerSubmission = {
	name: string;
	email: string;
	rolePreference: string;
	availability: string;
	notes: string;
};

export type ReminderSubmission = {
	email: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type D1PreparedStatement = {
	bind: (...values: unknown[]) => { run: () => Promise<unknown> };
};

type D1DatabaseLike = {
	prepare: (query: string) => D1PreparedStatement;
};

type PlatformWithDb = {
	env?: {
		DB?: unknown;
	};
};

function isD1DatabaseLike(value: unknown): value is D1DatabaseLike {
	if (!value || typeof value !== 'object') return false;
	const candidate = value as { prepare?: unknown };
	return typeof candidate.prepare === 'function';
}

function requireDb(platform: PlatformWithDb | undefined): D1DatabaseLike {
	const db = platform?.env?.DB;
	if (!db) {
		error(500, 'Database binding is missing. Configure D1 binding `DB`.');
	}
	if (!isD1DatabaseLike(db)) {
		error(500, 'Database binding `DB` is invalid.');
	}
	return db;
}

function parseText(value: FormDataEntryValue | null, field: string): string {
	if (typeof value !== 'string') {
		error(400, `${field} is required.`);
	}
	return value.trim();
}

function parseEmail(value: FormDataEntryValue | null): string {
	const email = parseText(value, 'Email').toLowerCase();
	if (!EMAIL_RE.test(email)) error(400, 'Enter a valid email address.');
	return email;
}

function parseName(value: FormDataEntryValue | null): string {
	const name = parseText(value, 'Name');
	if (name.length < 2 || name.length > 80) error(400, 'Enter your name.');
	return name;
}

function parseNotes(value: FormDataEntryValue | null): string {
	if (value === null) return '';
	const notes = parseText(value, 'Notes');
	if (notes.length > 1200) error(400, 'Notes are too long.');
	return notes;
}

function parseShort(value: FormDataEntryValue | null, max = 120): string {
	const text = parseText(value, 'Required field');
	if (!text || text.length > max) error(400, 'A required field is invalid.');
	return text;
}

export function assertHoneypot(form: FormData): void {
	const websiteEntry = form.get('website');
	const website = typeof websiteEntry === 'string' ? websiteEntry.trim() : '';
	if (website) error(400, 'Invalid submission.');
}

export async function saveJoin(platform: PlatformWithDb | undefined, form: FormData): Promise<void> {
	const db = requireDb(platform);
	const attendeesRaw = Number.parseInt(parseShort(form.get('attendees'), 2), 10);
	if (!Number.isFinite(attendeesRaw) || attendeesRaw < 1 || attendeesRaw > 20) {
		error(400, 'Attendee count must be between 1 and 20.');
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
