import type { PageServerLoad } from './$types';

import { getAuth } from '$lib/server/auth';

export const load: PageServerLoad = async (event) => {
	const auth = getAuth(event);
	const user = await auth.requireUser(event);
	return { user };
};

