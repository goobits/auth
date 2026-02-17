import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	ssr: {
		resolve: {
			// Cloudflare workers build: prefer `exports.worker` over `exports.node`.
			conditions: ['worker', 'node', 'import', 'default']
		}
	},
	server: {
		// vm.yaml reserves ports 3580-3589 and binds them to the host.
		host: true, // 0.0.0.0
		port: Number(process.env.PORT) || 3580,
		strictPort: true
	},
	preview: {
		host: true,
		port: Number(process.env.PORT) || 3580,
		strictPort: true
	}
});
