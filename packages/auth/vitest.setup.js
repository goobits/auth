const SUPPRESSED_SNIPPETS = [
	'src/app.html does not exist',
	'[Signin] Error: Redirect',
	'[Signup] Failed to send verification email',
	'[Signup] Error: Redirect',
	'Password verification error: [Error: password hash string missing field]',
];

const shouldSuppress = (args) => {
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

	return SUPPRESSED_SNIPPETS.some((snippet) => message.includes(snippet));
};

const wrapConsole = (method) => {
	const original = console[method];
	console[method] = (...args) => {
		if (shouldSuppress(args)) return;
		original(...args);
	};
};

wrapConsole('error');
wrapConsole('warn');
