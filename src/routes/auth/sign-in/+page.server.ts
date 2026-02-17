import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import { getAuth, getCredentialsProvider } from '$lib/server/auth';
import { assertHoneypot } from '$lib/server/submissions';
import { assertTurnstile } from '$lib/server/turnstile';
import { raise } from '$lib/server/http-error';

export const load: PageServerLoad = async (event) => {
	const auth = getAuth(event);
	const session = await auth.getSession(event);
	if (session) redirect(303, '/account');
	return {};
};

export const actions = {
	default: async (event) => {
		const form = await event.request.formData();
		assertHoneypot(form);
		await assertTurnstile(event.request, form, 'auth-signin', event.platform?.env);

		const auth = getAuth(event);
		const userAdapter = auth.adapter.user;
		if (!userAdapter) raise(500, 'User adapter is not configured.');
		const sessionAdapter = auth.adapter.session;

		const email = form.get('email');
		const password = form.get('password');
		if (typeof email !== 'string' || typeof password !== 'string') {
			return { success: false, error: 'Email and password are required.' };
		}

		const credentials = getCredentialsProvider();
		const result = await credentials.authenticate({
			email: email.trim().toLowerCase(),
			password,
			userAdapter
		});

		const user = result.user;
		const userId = user && typeof user === 'object' && 'id' in user ? (user as { id: unknown }).id : null;
		if (!result.valid || !userId || typeof userId !== 'string') {
			return { success: false, error: 'Invalid email or password.' };
		}

		const session = await sessionAdapter.createSession(userId, {
			ip: event.getClientAddress(),
			userAgent: event.request.headers.get('user-agent') ?? undefined
		});

		sessionAdapter.setSessionCookie(event.cookies, session);
		redirect(303, '/account');
	}
} satisfies Actions;
