import { describe, expect, it } from 'vitest';
import { assertHoneypot, parseEmail, parseName, parseNotes, parseShort } from '../../src/lib/server/submissions/validators';

describe('submissions validators', () => {
	it('normalizes and validates email', () => {
		expect(parseEmail('  USER@Example.com ')).toBe('user@example.com');
	});

	it('rejects invalid email', () => {
		expect(() => parseEmail('not-an-email')).toThrow();
	});

	it('accepts valid name and rejects short name', () => {
		expect(parseName('Dino Runner')).toBe('Dino Runner');
		expect(() => parseName('A')).toThrow();
	});

	it('limits note length', () => {
		expect(parseNotes('')).toBe('');
		expect(() => parseNotes('x'.repeat(1201))).toThrow();
	});

	it('validates required short fields', () => {
		expect(parseShort('  Hatchling Loop  ')).toBe('Hatchling Loop');
		expect(() => parseShort('')).toThrow();
	});

	it('rejects honeypot spam submissions', () => {
		const form = new FormData();
		form.set('website', 'https://spam.example');
		expect(() => {
			assertHoneypot(form);
		}).toThrow();
	});

	it('accepts clean honeypot field', () => {
		const form = new FormData();
		form.set('website', '');
		expect(() => {
			assertHoneypot(form);
		}).not.toThrow();
	});
});
