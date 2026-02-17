import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://127.0.0.1:3580';

export default defineConfig({
	testDir: '__tests__/e2e',
	// Local D1 (SQLite) used by `wrangler pages dev` can throw transient 500s under
	// high parallelism (DB busy/locked). Keep E2E stable and deterministic.
	fullyParallel: false,
	workers: 1,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	reporter: [['list'], ['html', { open: 'never' }]],
	use: {
		baseURL,
		trace: 'retain-on-failure'
	},
	webServer: {
		command: 'node scripts/e2e-server.mjs',
		url: baseURL,
		reuseExistingServer: false,
		timeout: 180_000
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		}
	]
});
