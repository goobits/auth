export type Logger = {
	debug?: (...args: unknown[]) => void;
	info?: (...args: unknown[]) => void;
	warn?: (...args: unknown[]) => void;
	error?: (...args: unknown[]) => void;
};

const noop = () => {};

let activeLoggers: Logger[] = [];

export function setLogger(logger: Logger | null | undefined) {
	if (!logger) {
		activeLoggers = [];
		return;
	}

	if (!activeLoggers.includes(logger)) {
		activeLoggers.push(logger);
	}
}

export function getLogger(): Logger {
	if (activeLoggers.length === 0) {
		return {
			debug: noop,
			info: noop,
			warn: noop,
			error: noop,
		};
	}

	const forward = (level: keyof Logger, args: unknown[]) => {
		for (const logger of activeLoggers) {
			logger[level]?.(...args);
		}
	};

	return {
		debug: (...args: unknown[]) => forward("debug", args),
		info: (...args: unknown[]) => forward("info", args),
		warn: (...args: unknown[]) => forward("warn", args),
		error: (...args: unknown[]) => forward("error", args),
	};
}
