import { defineConfig } from 'vitest/config';
import { shouldSuppressConsoleMessage } from './__tests__/console-suppressions.js';

export default defineConfig({
	test: {
		setupFiles: ['./vitest.setup.js'],
		onConsoleLog(log) {
			if (shouldSuppressConsoleMessage(log)) return false;
		},
	},
});
