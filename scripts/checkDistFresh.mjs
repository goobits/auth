import { isDistFresh } from './sourceFingerprint.mjs'

if (!(await isDistFresh())) {
	console.error('@goobits/auth dist is missing or stale; run `pnpm run build` in packages/auth')
	process.exitCode = 1
} else {
	console.log('@goobits/auth dist matches its source fingerprint')
}
