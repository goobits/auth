import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertHoneypot, saveReminder } from '$lib/server/submissions';

export const POST: RequestHandler = async (event) => {
	const form = await event.request.formData();
	assertHoneypot(form);
	await saveReminder(event.platform, form);
	redirect(303, '/thanks?type=remind');
};
