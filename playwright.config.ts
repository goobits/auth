import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://127.0.0.1:3580';

export default defineConfig({
	testDir: '__tests__/e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	reporter: [['list'], ['html', { open: 'never' }]],
	use: {
		baseURL,
		trace: 'retain-on-failure'
	},
	webServer: {
		command:
			'pnpm db:migrate:local && pnpm build && wrangler pages dev .svelte-kit/cloudflare --ip 0.0.0.0 --port 3580 --env-file .env.test',
		url: baseURL,
		reuseExistingServer: true,
		timeout: 180_000
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		}
	]
});
