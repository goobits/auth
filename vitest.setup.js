import { shouldSuppressConsoleArgs } from './__tests__/console-suppressions.js';

const wrapConsole = (method) => {
	const original = console[method];
	console[method] = (...args) => {
		if (shouldSuppressConsoleArgs(args)) return;
		original(...args);
	};
};

wrapConsole('error');
wrapConsole('warn');
