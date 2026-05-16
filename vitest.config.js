import { defineConfig } from 'vitest/config';

const SUPPRESSED_SNIPPETS = [
	'src/app.html does not exist',
	'[Signin] Error: Redirect',
	'[Signup] Failed to send verification email',
	'[Signup] Error: Redirect',
	'Password verification error: [Error: password hash string missing field]',
];

const shouldSuppress = (log) =>
	SUPPRESSED_SNIPPETS.some((snippet) => log.includes(snippet));

export default defineConfig({
	test: {
		setupFiles: ['./vitest.setup.js'],
		onConsoleLog(log) {
			if (shouldSuppress(log)) return false;
		},
	},
});
