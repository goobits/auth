import type { D1DatabaseLike, PlatformWithDb } from './types';
import { raise } from '../http-error';

function isD1DatabaseLike(value: unknown): value is D1DatabaseLike {
	if (!value || typeof value !== 'object') return false;
	const candidate = value as { prepare?: unknown };
	return typeof candidate.prepare === 'function';
}

export function requireDb(platform: PlatformWithDb | undefined): D1DatabaseLike {
	const db = platform?.env?.DB;
	if (!db) {
		raise(500, 'Database binding is missing. Configure D1 binding `DB`.');
	}
	if (!isD1DatabaseLike(db)) {
		raise(500, 'Database binding `DB` is invalid.');
	}
	return db;
}
