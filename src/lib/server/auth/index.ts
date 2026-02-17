import { GoobitsAuth } from '@goobits/auth';
import { D1UserAdapter } from '@goobits/auth/adapters/database';
import { D1SessionAdapter } from '@goobits/auth/adapters/session';
import { CredentialsProvider } from '@goobits/auth/providers';
import type { RequestEvent } from '@sveltejs/kit';

import { raise } from '$lib/server/http-error';
import { hashPasswordPbkdf2, verifyPasswordPbkdf2 } from '$lib/server/auth/password';

function wantsSecureCookies(event: Pick<RequestEvent, 'url'>): boolean {
	// Cloudflare Pages production is HTTPS. Local `wrangler pages dev` is HTTP.
	return event.url.protocol === 'https:';
}

export function getSessionAdapter(event: RequestEvent) {
	const platform = event.platform;
	if (!platform) raise(500, 'Cloudflare platform bindings are missing. Use `pnpm cf:dev` for local testing.');
	const db = platform.env?.DB as unknown;
	if (!db) raise(500, 'Database binding is missing. Configure D1 binding `DB`.');
	return new D1SessionAdapter(db as unknown as ConstructorParameters<typeof D1SessionAdapter>[0], {
		secureCookies: wantsSecureCookies(event)
	});
}

export function getAuth(event: RequestEvent) {
	const platform = event.platform;
	if (!platform) raise(500, 'Cloudflare platform bindings are missing. Use `pnpm cf:dev` for local testing.');
	const db = platform.env?.DB as unknown;
	if (!db) raise(500, 'Database binding is missing. Configure D1 binding `DB`.');

	const user = new D1UserAdapter(db as unknown as ConstructorParameters<typeof D1UserAdapter>[0]);
	const session = getSessionAdapter(event);

	return new GoobitsAuth({
		profile: 'strict',
		adapter: {
			user,
			session
		},
		cookies: {
			secure: wantsSecureCookies(event)
		},
		routing: {
			basePath: '/api/auth',
			signInPath: '/auth/sign-in',
			signOutPath: '/auth/sign-out'
		}
	});
}

export function getCredentialsProvider() {
	return new CredentialsProvider({
		hashPassword: hashPasswordPbkdf2,
		verifyPassword: verifyPasswordPbkdf2,
		validatePassword(password) {
			const errors: string[] = [];
			if (password.length < 10) errors.push('Password must be at least 10 characters.');
			if (!/[A-Z]/.test(password)) errors.push('Add an uppercase letter.');
			if (!/[a-z]/.test(password)) errors.push('Add a lowercase letter.');
			if (!/[0-9]/.test(password)) errors.push('Add a number.');
			if (!/[^A-Za-z0-9]/.test(password)) errors.push('Add a symbol.');
			return { valid: errors.length === 0, errors };
		}
	});
}
