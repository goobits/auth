import { shouldSuppressConsoleArgs } from './__tests__/consoleSuppressions.js'

type SuppressedConsoleMethod = 'error' | 'warn'

const wrapConsole = (method: SuppressedConsoleMethod): void => {
	const original = console[method]
	console[method] = (...args: unknown[]) => {
		if (shouldSuppressConsoleArgs(args)) return
		original(...args)
	}
}

wrapConsole('error')
wrapConsole('warn')
