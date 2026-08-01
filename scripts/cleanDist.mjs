import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const distDirectory = path.join(packageRoot, 'dist')

if (!fs.existsSync(distDirectory)) {
	fs.mkdirSync(distDirectory, { recursive: true })
}

for (const entry of fs.readdirSync(distDirectory)) {
	fs.rmSync(path.join(distDirectory, entry), { force: true, recursive: true })
}
