import { raise } from '../http-error';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseText(value: FormDataEntryValue | null, field: string): string {
	if (typeof value !== 'string') {
		raise(400, `${field} is required.`);
	}
	return value.trim();
}

export function parseEmail(value: FormDataEntryValue | null): string {
	const email = parseText(value, 'Email').toLowerCase();
	if (!EMAIL_RE.test(email)) raise(400, 'Enter a valid email address.');
	return email;
}

export function parseName(value: FormDataEntryValue | null): string {
	const name = parseText(value, 'Name');
	if (name.length < 2 || name.length > 80) raise(400, 'Enter your name.');
	return name;
}

export function parseNotes(value: FormDataEntryValue | null): string {
	if (value === null) return '';
	const notes = parseText(value, 'Notes');
	if (notes.length > 1200) raise(400, 'Notes are too long.');
	return notes;
}

export function parseShort(value: FormDataEntryValue | null, max = 120): string {
	const text = parseText(value, 'Required field');
	if (!text || text.length > max) raise(400, 'A required field is invalid.');
	return text;
}

export function assertHoneypot(form: FormData): void {
	const websiteEntry = form.get('website');
	const website = typeof websiteEntry === 'string' ? websiteEntry.trim() : '';
	if (website) raise(400, 'Invalid submission.');
}
