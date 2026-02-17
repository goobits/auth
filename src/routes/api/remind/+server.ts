import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertHoneypot, saveReminder } from '$lib/server/submissions';
import { assertTurnstile } from '$lib/server/turnstile';

export const POST: RequestHandler = async (event) => {
	const form = await event.request.formData();
	assertHoneypot(form);
	await assertTurnstile(event.request, form, 'remind', event.platform?.env);
	await saveReminder(event.platform, form);
	redirect(303, '/thanks?type=remind');
};
