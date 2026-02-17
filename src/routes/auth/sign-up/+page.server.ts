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
		await assertTurnstile(event.request, form, 'auth-signup', event.platform?.env);

		const auth = getAuth(event);
		const userAdapter = auth.adapter.user;
		if (!userAdapter) raise(500, 'User adapter is not configured.');
		const sessionAdapter = auth.adapter.session;

		const email = form.get('email');
		const password = form.get('password');
		const name = form.get('name');
		if (typeof email !== 'string' || typeof password !== 'string') {
			return { success: false, error: 'Email and password are required.' };
		}

		const normalizedEmail = email.trim().toLowerCase();
		const existing = await userAdapter.getUserByEmail(normalizedEmail);
		if (existing) {
			return { success: false, error: 'An account with this email already exists.' };
		}

		const credentials = getCredentialsProvider();
		const signUpInput: Parameters<typeof credentials.signUp>[0] = {
			email: normalizedEmail,
			password,
			userAdapter
		};
		if (typeof name === 'string' && name.trim().length > 0) {
			signUpInput.name = name.trim();
		}
		const user = await credentials.signUp(signUpInput);

		const userId = 'id' in user ? (user as { id: unknown }).id : null;
		if (!userId || typeof userId !== 'string') {
			raise(500, 'Signup succeeded but user id is missing.');
		}

		const session = await sessionAdapter.createSession(userId, {
			ip: event.getClientAddress(),
			userAgent: event.request.headers.get('user-agent') ?? undefined
		});
		sessionAdapter.setSessionCookie(event.cookies, session);
		redirect(303, '/account');
	}
} satisfies Actions;
