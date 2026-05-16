export const SUPPRESSED_SNIPPETS = [
	'src/app.html does not exist',
	'[Signin] Error: Redirect',
	'[Signup] Failed to send verification email',
	'[Signup] Error: Redirect',
	'Password verification error: [Error: password hash string missing field]'
];

export const shouldSuppressConsoleMessage = (message) =>
	SUPPRESSED_SNIPPETS.some((snippet) => String(message).includes(snippet));

export const shouldSuppressConsoleArgs = (args) => {
	const message = args
		.map((arg) => {
			if (typeof arg === 'string') return arg;
			if (arg && typeof arg.message === 'string') return arg.message;
			try {
				return JSON.stringify(arg);
			} catch {
				return '';
			}
		})
		.join(' ');

	return shouldSuppressConsoleMessage(message);
};
