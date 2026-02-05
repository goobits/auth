export type Logger = {
	debug?: (...args: unknown[]) => void;
	info?: (...args: unknown[]) => void;
	warn?: (...args: unknown[]) => void;
	error?: (...args: unknown[]) => void;
};

const noop = () => {};

let activeLogger: Logger = {
	debug: noop,
	info: noop,
	warn: noop,
	error: noop,
};

export function setLogger(logger: Logger | null | undefined) {
	activeLogger = logger ?? {
		debug: noop,
		info: noop,
		warn: noop,
		error: noop,
	};
}

export function getLogger(): Logger {
	return activeLogger;
}
