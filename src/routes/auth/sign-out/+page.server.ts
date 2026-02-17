import type { Actions, PageServerLoad } from './$types';

import { createLogoutHandler } from '@goobits/auth/handlers';
import { getAuth, getSessionAdapter } from '$lib/server/auth';

export const load: PageServerLoad = async (event) => {
	const auth = getAuth(event);
	await auth.requireUser(event);
	return {};
};

export const actions = {
	default: (event) =>
		createLogoutHandler({
			sessionAdapter: getSessionAdapter(event),
			redirectAfterLogout: '/'
		})(event)
} satisfies Actions;
