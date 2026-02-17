#!/usr/bin/env node
import { promises as fs } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const STATIC_DIR = path.join(ROOT, 'static')
const SEARCH_DIRS = [path.join(ROOT, 'src'), path.join(ROOT, 'static')]
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif', '.ico'])
const REPORT_PATH = path.join(ROOT, '.llm', 'scratch', 'unused-image-candidates.txt')
const RELATIVE_IMAGE_RE = /["'`(]((?:\.\.?\/)?[^"'`\s)]+\.(?:png|jpe?g|gif|webp|svg|avif|ico))(?:[?#][^"'`\s)]*)?["'`)]/gi
const ABSOLUTE_IMAGE_RE = /\/static\/[\w./-]+\.(?:png|jpe?g|gif|webp|svg|avif|ico)|\/[\w./-]+\.(?:png|jpe?g|gif|webp|svg|avif|ico)/gi

async function walk(dir) {
  const files = []
  let entries = []
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return files
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await walk(full)))
    } else {
      files.push(full)
    }
  }
  return files
}

function toPosix(filePath) {
  return filePath.replaceAll('\\\\', '/')
}

function normalizeRef(match) {
  const clean = match.replace(/[?#].*$/, '')
  if (clean.startsWith('/static/')) return clean.slice('/static/'.length)
  if (clean.startsWith('/')) return clean.slice(1)
  return clean
}

async function run() {
  const staticFiles = await walk(STATIC_DIR)
  const images = staticFiles.filter((file) => IMAGE_EXTS.has(path.extname(file).toLowerCase()))

  const sourceFiles = []
  for (const dir of SEARCH_DIRS) {
    sourceFiles.push(...(await walk(dir)))
  }

  const referenced = new Set()
  for (const sourceFile of sourceFiles) {
    const relSource = toPosix(path.relative(ROOT, sourceFile))
    if (relSource === toPosix(path.relative(ROOT, REPORT_PATH))) continue

    let content = ''
    try {
      content = await fs.readFile(sourceFile, 'utf8')
    } catch {
      continue
    }

    const absoluteMatches = content.match(ABSOLUTE_IMAGE_RE) || []
    for (const match of absoluteMatches) {
      referenced.add(normalizeRef(match))
    }

    const relativeMatches = [...content.matchAll(RELATIVE_IMAGE_RE)]
    for (const relativeMatch of relativeMatches) {
      const rawRef = relativeMatch[1]
      if (!rawRef) continue
      const normalizedRef = normalizeRef(rawRef)
      const resolved = path.resolve(path.dirname(sourceFile), normalizedRef)
      if (!resolved.startsWith(STATIC_DIR)) continue
      const staticRelative = toPosix(path.relative(STATIC_DIR, resolved))
      referenced.add(staticRelative)
    }
  }

  const unused = []
  for (const imagePath of images) {
    const rel = toPosix(path.relative(STATIC_DIR, imagePath))
    if (!referenced.has(rel)) unused.push(rel)
  }

  await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true })
  const lines = [
    `Total images in static/: ${images.length}`,
    `Unused image candidates: ${unused.length}`,
    '',
    ...unused.sort()
  ]
  await fs.writeFile(REPORT_PATH, `${lines.join('\n')}\n`, 'utf8')

  console.log(`Report written: ${toPosix(path.relative(ROOT, REPORT_PATH))}`)
  console.log(`Total images: ${images.length}`)
  console.log(`Unused candidates: ${unused.length}`)
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
