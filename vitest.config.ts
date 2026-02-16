import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['__tests__/unit/**/*.test.ts'],
		environment: 'node',
		coverage: {
			provider: 'v8',
			reporter: ['text', 'html'],
			include: ['src/lib/server/submissions/**/*.ts', 'src/routes/thanks/+page.server.ts']
		}
	}
});
