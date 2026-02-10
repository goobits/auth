/**
 * One-step production deploy:
 * 1) Push secrets (when --full)
 * 2) Build
 * 3) Deploy Cloudflare Pages artifact
 *
 * Usage:
 *   pnpm deploy:prod
 *   pnpm deploy:prod -- --full
 */

import { spawnSync } from 'node:child_process'

const args = process.argv.slice(2)
const fullDeploy = args.includes('--full')
const projectName = process.env.CF_PAGES_PROJECT || 'miko-art'

function run(cmd, cmdArgs) {
	const result = spawnSync(cmd, cmdArgs, { stdio: 'inherit' })
	if (result.status !== 0) {
		process.exit(result.status ?? 1)
	}
}

if (fullDeploy) {
	run('pnpm', ['deploy:secrets'])
}

run('pnpm', ['build'])
run('wrangler', ['pages', 'deploy', '.svelte-kit/cloudflare', '--project-name', projectName])
