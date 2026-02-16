import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { assertHoneypot, saveJoin } from '$lib/server/submissions';

export const actions = {
	default: async (event) => {
		const form = await event.request.formData();
		assertHoneypot(form);
		await saveJoin(event.platform, form);
		redirect(303, '/thanks?type=join');
	}
} satisfies Actions;
