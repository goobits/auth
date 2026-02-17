import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { assertHoneypot, saveVolunteer } from '$lib/server/submissions';
import { assertTurnstile } from '$lib/server/turnstile';

export const actions = {
	default: async (event) => {
		const form = await event.request.formData();
		assertHoneypot(form);
		await assertTurnstile(event.request, form, 'volunteer', event.platform?.env);
		await saveVolunteer(event.platform, form);
		redirect(303, '/thanks?type=volunteer');
	}
} satisfies Actions;
