import type { PageServerLoad } from './$types';

const allowed = new Set(['join', 'volunteer', 'remind', 'donate']);

export const load: PageServerLoad = ({ url }) => {
	const raw = (url.searchParams.get('type') ?? '').toLowerCase();
	const type = allowed.has(raw) ? raw : 'general';
	return { type };
};
