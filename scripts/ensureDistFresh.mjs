import { spawnSync } from 'node:child_process'

import { isDistFresh, packageRoot } from './sourceFingerprint.mjs'

if (await isDistFresh()) {
	console.log('@goobits/auth dist matches its source fingerprint')
} else {
	console.log('@goobits/auth dist is missing or stale; rebuilding')
	const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
	const result = spawnSync(command, ['run', 'build'], {
		cwd: packageRoot,
		stdio: 'inherit'
	})
	if (result.error) throw result.error
	if (result.status !== 0) process.exit(result.status ?? 1)
}
