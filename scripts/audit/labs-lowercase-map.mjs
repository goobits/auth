#!/usr/bin/env node
import { promises as fs } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const LABS_ROOT = path.join(ROOT, 'static', 'labs')
const REPORT_PATH = path.join(ROOT, '.llm', 'scratch', 'labs-lowercase-collisions.txt')

async function walk(dir) {
  const out = []
  let entries = []
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    out.push({ full, isDirectory: entry.isDirectory() })
    if (entry.isDirectory()) out.push(...(await walk(full)))
  }
  return out
}

function toPosix(v) {
  return v.replaceAll('\\\\', '/')
}

async function run() {
  const entries = await walk(LABS_ROOT)
  const relativeDirectories = entries
    .filter((entry) => entry.isDirectory)
    .map((entry) => path.relative(LABS_ROOT, entry.full))
  const existingSet = new Set(relativeDirectories.map((entry) => entry.split(path.sep).join('/')))
  const uppercaseEntries = relativeDirectories.filter((entry) => /[A-Z]/.test(path.basename(entry)))

  const collisions = []
  const renameCandidates = []
  for (const source of uppercaseEntries) {
    const sourcePosix = source.split(path.sep).join('/')
    const target = sourcePosix
      .split('/')
      .map((segment) => segment.toLowerCase())
      .join('/')

    if (target !== sourcePosix && existingSet.has(target)) {
      collisions.push({ target, sources: [sourcePosix, target] })
      continue
    }
    renameCandidates.push({ source: sourcePosix, target })
  }

  const lines = [
    `Uppercase directories found: ${uppercaseEntries.length}`,
    `Safe rename candidates: ${renameCandidates.length}`,
    `Collision targets: ${collisions.length}`,
    '',
    'Collision details:'
  ]

  if (collisions.length === 0) {
    lines.push('(none)')
  } else {
    for (const collision of collisions) {
      lines.push(`TARGET: ${collision.target}`)
      for (const source of collision.sources) {
        lines.push(`  - ${toPosix(source)}`)
      }
    }
  }

  await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true })
  await fs.writeFile(REPORT_PATH, `${lines.join('\n')}\n`, 'utf8')

  console.log(`Report written: ${toPosix(path.relative(ROOT, REPORT_PATH))}`)
  console.log(`Uppercase directories: ${uppercaseEntries.length}`)
  console.log(`Safe candidates: ${renameCandidates.length}`)
  console.log(`Collision targets: ${collisions.length}`)
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
