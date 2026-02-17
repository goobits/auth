import type { Handle, HandleServerError } from '@sveltejs/kit';

import { getAuth } from '$lib/server/auth';

export const handle: Handle = async ({ event, resolve }) => {
	// Most of the site should still render without Cloudflare bindings (e.g. `pnpm dev`).
	// Auth + sessions require D1, so only attach auth when the platform env is available.
	if (!event.platform?.env?.DB) {
		return resolve(event);
	}
	try {
		return await getAuth(event).handle()({ event, resolve });
	} catch (error) {
		// The marketing site should not hard-fail if auth/session plumbing breaks.
		// Auth routes themselves will still enforce platform + DB requirements.
		console.error('[auth] handle failed; continuing without auth locals', error);
		return resolve(event);
	}
};

export const handleError: HandleServerError = ({ error, event }) => {
	console.error('[server] unhandled error', event.url.pathname, error);
};
