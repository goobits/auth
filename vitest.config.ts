import { defineConfig } from 'vitest/config'

import { shouldSuppressConsoleMessage } from './__tests__/consoleSuppressions.js'

export default defineConfig({
	test: {
		setupFiles: ['./vitest.setup.ts'],
		onConsoleLog(log) {
			if (shouldSuppressConsoleMessage(log)) return false
		}
	}
})
