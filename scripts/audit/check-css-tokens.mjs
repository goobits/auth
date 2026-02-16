#!/usr/bin/env node
import { promises as fs } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const TARGET_DIRS = [
  'src/styles',
  'src/lib/theme',
  'src/routes/admin/styles',
  'src/routes/calendar/styles',
  'src/routes/art',
  'src/routes/music',
  'src/routes/about',
  'src/routes/contact',
  'src/app.scss'
]

const FILE_EXTENSIONS = new Set(['.css', '.scss', '.svelte'])
const COLOR_RE = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g
const PX_RE = /\b(\d+(?:\.\d+)?)px\b/g

const IGNORE_FILES = new Set([
  'src/components/prism.scss'
])

async function walk(dir) {
  const out = []
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...(await walk(full)))
    } else {
      out.push(full)
    }
  }
  return out
}

function extractStyleLines(filePath, content) {
  if (!filePath.endsWith('.svelte')) return content.split(/\r?\n/)
  const lines = []
  const styleBlocks = [...content.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
  for (const block of styleBlocks) {
    lines.push(...block[1].split(/\r?\n/))
  }
  return lines
}

function shouldSkipLine(line) {
  const trimmed = line.trim()
  return (
    !trimmed ||
    trimmed.startsWith('//') ||
    trimmed.startsWith('/*') ||
    trimmed.startsWith('*') ||
    trimmed.startsWith('--') ||
    trimmed.includes('css-token-audit-ignore')
  )
}

function collectMatches(re, line) {
  return [...line.matchAll(re)].map((m) => m[0])
}

async function getTargetFiles() {
  const files = []
  for (const target of TARGET_DIRS) {
    const full = path.join(ROOT, target)
    try {
      const stat = await fs.stat(full)
      if (stat.isFile()) {
        files.push(full)
        continue
      }
      const walked = await walk(full)
      files.push(...walked)
    } catch {
      // ignore missing targets
    }
  }

  return files
    .filter((f, i, arr) => arr.indexOf(f) === i)
    .filter((f) => FILE_EXTENSIONS.has(path.extname(f)))
    .filter((f) => !IGNORE_FILES.has(path.relative(ROOT, f).replaceAll('\\\\', '/')))
}

async function run() {
  const files = await getTargetFiles()
  const colorFindings = []
  const pxFindings = []

  for (const file of files) {
    const rel = path.relative(ROOT, file).replaceAll('\\\\', '/')
    const content = await fs.readFile(file, 'utf8')
    const lines = extractStyleLines(file, content)

    lines.forEach((line, idx) => {
      if (shouldSkipLine(line)) return

      const colorMatches = collectMatches(COLOR_RE, line)
      if (colorMatches.length) {
        colorFindings.push({ file: rel, line: idx + 1, values: colorMatches.join(', ') })
      }

      const pxMatches = collectMatches(PX_RE, line)
      const filteredPx = pxMatches.filter((value) => value !== '0px' && value !== '1px' && !line.includes('var('))
      if (filteredPx.length) {
        pxFindings.push({ file: rel, line: idx + 1, values: filteredPx.join(', ') })
      }
    })
  }

  if (colorFindings.length === 0 && pxFindings.length === 0) {
    console.log('OK: no raw color literals or non-token px values detected in audited CSS files.')
    return
  }

  if (colorFindings.length) {
    console.error('\nRaw color literals (replace with CSS variables):')
    for (const finding of colorFindings.slice(0, 200)) {
      console.error(`- ${finding.file}:${finding.line} -> ${finding.values}`)
    }
  }

  if (pxFindings.length) {
    console.error('\nNon-token px values found (review for tokenization):')
    for (const finding of pxFindings.slice(0, 200)) {
      console.error(`- ${finding.file}:${finding.line} -> ${finding.values}`)
    }
  }

  if (colorFindings.length || pxFindings.length) {
    process.exitCode = 1
  }
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
