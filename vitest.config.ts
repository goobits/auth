import { defineConfig } from 'vitest/config'

import { shouldSuppressConsoleMessage } from './__tests__/consoleSuppressions.js'
import { resolveViteCacheDirectory } from './scripts/testStorage.ts'

export default defineConfig({
	cacheDir: resolveViteCacheDirectory(import.meta.dirname),
	test: {
		...(process.env.CI ? {} : { maxWorkers: 2 }),
		setupFiles: ['./vitest.setup.ts'],
		onConsoleLog(log) {
			if (shouldSuppressConsoleMessage(log)) return false
		},
		coverage: {
			provider: 'v8',
			reporter: ['text', 'lcov'],
			include: ['src/**/*.ts'],
			exclude: ['src/_internal/**', '**/*.d.ts', 'src/index.ts'],
			// Keep the broad published runtime surface from regressing. Raise these
			// floors as optional adapters gain coverage; never silently lower them.
			thresholds: {
				lines: 65,
				branches: 55,
				functions: 60,
				statements: 60
			}
		}
	}
})
