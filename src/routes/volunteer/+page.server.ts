import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { assertHoneypot, saveVolunteer } from '$lib/server/submissions';

export const actions = {
	default: async (event) => {
		const form = await event.request.formData();
		assertHoneypot(form);
		await saveVolunteer(event.platform, form);
		redirect(303, '/thanks?type=volunteer');
	}
} satisfies Actions;
