import { shouldSuppressConsoleArgs } from './__tests__/consoleSuppressions.js'

const wrapConsole = method => {
	const original = console[method]
	console[method] = (...args) => {
		if (shouldSuppressConsoleArgs(args)) return
		original(...args)
	}
}

wrapConsole('error')
wrapConsole('warn')
