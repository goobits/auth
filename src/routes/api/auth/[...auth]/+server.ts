import type { RequestHandler } from './$types';

import { getAuth } from '$lib/server/auth';

export const GET: RequestHandler = (event) => {
	return getAuth(event).handlers.GET(event);
};

export const POST: RequestHandler = (event) => {
	return getAuth(event).handlers.POST(event);
};

