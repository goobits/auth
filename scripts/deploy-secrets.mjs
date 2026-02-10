/**
 * Push encrypted production secrets to Cloudflare.
 * Usage: pnpm deploy:secrets
 *
 * Reads key names from .env.production, takes their decrypted values
 * from process.env (injected by dotenvx run), and pipes them to
 * `wrangler secret bulk`.
 */

import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const envFile = readFileSync('config/env/.env.production', 'utf8')
const keys = envFile
	.split('\n')
	.map(l => l.trim())
	.filter(l => l && !l.startsWith('#') && !l.startsWith('DOTENV_') && l.includes('='))
	.map(l => l.split('=')[0].trim())

const secrets = {}
for (const key of keys) {
	if (process.env[key]) secrets[key] = process.env[key]
}

const count = Object.keys(secrets).length
if (count === 0) {
	console.error('No secrets found. Fill in config/env/.env.production and encrypt it first.')
	process.exit(1)
}

console.log(`Pushing ${count} secrets to Cloudflare: ${Object.keys(secrets).join(', ')}`)
execSync('wrangler secret bulk', {
	input: JSON.stringify(secrets),
	stdio: ['pipe', 'inherit', 'inherit']
})
