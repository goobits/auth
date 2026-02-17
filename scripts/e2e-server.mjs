import { spawn } from 'node:child_process';

const PORT = process.env.E2E_PORT ?? '3580';
const HOST = process.env.E2E_HOST ?? '127.0.0.1';
const BASE_URL = `http://${HOST}:${PORT}`;

function run(command, args, options = {}) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, { stdio: 'inherit', ...options });
		child.on('error', reject);
		child.on('exit', (code) => {
			if (code === 0) resolve();
			else reject(new Error(`${command} ${args.join(' ')} exited with ${code}`));
		});
	});
}

async function waitForHealthy(url, { timeoutMs = 60_000, mustInclude } = {}) {
	const deadline = Date.now() + timeoutMs;
	let lastError = null;
	// Pages dev can return transient 500s while booting; don't start tests until stable.
	while (Date.now() < deadline) {
		try {
			const response = await fetch(url, { redirect: 'follow' });
			if (response.ok) {
				const text = await response.text();
				if (!mustInclude) return;
				if (text.toLowerCase().includes(String(mustInclude).toLowerCase())) return;
			}
		} catch (error) {
			lastError = error;
		}
		await new Promise((r) => setTimeout(r, 250));
	}
	throw new Error(`Timed out waiting for ${url} to become healthy. Last error: ${String(lastError)}`);
}

async function main() {
	await run('pnpm', ['db:migrate:local']);
	await run('pnpm', ['build']);

	const wrangler = spawn(
		'pnpm',
		[
			'wrangler',
			'pages',
			'dev',
			'.svelte-kit/cloudflare',
			'--ip',
			'0.0.0.0',
			'--port',
			PORT,
			'--env-file',
			'.env.test'
		],
		{
			stdio: 'inherit',
			// SvelteKit SSR uses NODE_ENV to decide whether to emit `__sveltekit_dev` vs
			// `__sveltekit_<hash>`. The client build expects the hashed global.
			env: { ...process.env, NODE_ENV: 'production' }
		}
	);

	const shutdown = () => {
		wrangler.kill('SIGTERM');
	};
	process.once('SIGINT', shutdown);
	process.once('SIGTERM', shutdown);

	// Warm key routes so the first real test doesn't hit a cold-start 500.
	await waitForHealthy(`${BASE_URL}/`, { mustInclude: 'PDX Dino Run' });
	await waitForHealthy(`${BASE_URL}/join`, { mustInclude: 'Join the Herd' });
	await waitForHealthy(`${BASE_URL}/volunteer`, { mustInclude: 'Volunteer' });
	await waitForHealthy(`${BASE_URL}/auth/sign-up`, { mustInclude: 'Create account' });

	await new Promise((resolve, reject) => {
		wrangler.on('error', reject);
		wrangler.on('exit', (code) => {
			if (code === 0) resolve();
			else reject(new Error(`wrangler exited with ${code}`));
		});
	});
}

await main();
