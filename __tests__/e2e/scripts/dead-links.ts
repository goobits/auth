#!/usr/bin/env node
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const ROOT = process.cwd()
const ROUTES_DIR = path.join(ROOT, 'src', 'routes')
const STATIC_DIR = path.join(ROOT, 'static')
const SRC_DIR = path.join(ROOT, 'src')

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3610'

const SOURCE_EXTENSIONS = new Set(['.svelte', '.ts', '.js', '.scss', '.css', '.md', '.svx'])
const PAGE_FILE_RE = /^\+page\.(svelte|ts|js)$/
const SERVER_FILE_RE = /^\+server\.(ts|js)$/

const EXEMPT_PATHS = new Set([
  '/sitemap.xml',
  '/robots.txt'
])

const IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.svg',
  '.avif',
  '.ico'
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

function isRouteGroupSegment(segment) {
  return segment.startsWith('(') && segment.endsWith(')')
}

function routePathFromDir(dir) {
  const rel = path.relative(ROUTES_DIR, dir)
  if (!rel || rel === '.') return '/'
  const parts = rel.split(path.sep).filter(Boolean).filter((p) => !isRouteGroupSegment(p))
  return '/' + parts.join('/')
}

function normalizeUrlPath(raw) {
  if (!raw) return null
  if (/^(https?:|mailto:|tel:|#|javascript:|data:)/i.test(raw)) return null
  let v = raw.trim()
  // Avoid flagging templated paths like `/media/project-{id}.png` in Svelte styles.
  if (/[{}]/.test(v)) return null
  if (!v.startsWith('/')) return null
  v = v.split('#')[0].split('?')[0]
  if (!v) return '/'
  if (v.length > 1 && v.endsWith('/')) v = v.slice(0, -1)
  return v
}

function dynamicRouteToRegex(route) {
  const parts = route.split('/').filter(Boolean)
  const pattern = parts
    .map((part) => {
      if (part.startsWith('[...') && part.endsWith(']')) return '(.+)?'
      if (part.startsWith('[') && part.endsWith(']')) return '[^/]+'
      return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    })
    .join('/')
  return new RegExp(`^/${pattern}$`)
}

function extractAttrValues(content, attr) {
  const values = []
  const re = new RegExp(`${attr}\\s*=\\s*(["'])(.*?)\\1`, 'g')
  for (const match of content.matchAll(re)) values.push(match[2])
  return values
}

function extractCssUrlValues(content) {
  const values = []
  const re = /url\(\s*(["']?)([^"')]+)\1\s*\)/g
  for (const match of content.matchAll(re)) values.push(match[2])
  return values
}

function extractSrcsetUrls(raw) {
  const urls = []
  for (const part of String(raw).split(',')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const url = trimmed.split(/\s+/)[0]
    if (url) urls.push(url)
  }
  return urls
}

function extnameFromUrlPath(p) {
  try {
    return path.extname(p)
  } catch {
    return ''
  }
}

function isLikelyImagePath(p) {
  const ext = extnameFromUrlPath(p).toLowerCase()
  return IMAGE_EXTENSIONS.has(ext)
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function collectRoutes() {
  const files = await walk(ROUTES_DIR)
  const staticRoutes = new Set()
  const dynamicRoutes = []

  for (const file of files) {
    const base = path.basename(file)
    if (!PAGE_FILE_RE.test(base) && !SERVER_FILE_RE.test(base)) continue
    const dir = path.dirname(file)
    const route = routePathFromDir(dir)
    if (route.includes('[')) {
      dynamicRoutes.push(dynamicRouteToRegex(route))
    } else {
      staticRoutes.add(route === '' ? '/' : route)
    }
  }

  return { staticRoutes, dynamicRoutes }
}

function uniq(arr) {
  return [...new Set(arr)]
}

async function fetchText(url) {
  const res = await fetch(url, { redirect: 'follow' })
  return { res, text: await res.text() }
}

function parseSitemapLocs(xmlText) {
  // Very small XML extraction: grab <loc>...</loc>
  const locs = []
  const re = /<loc>([^<]+)<\/loc>/g
  for (const m of xmlText.matchAll(re)) locs.push(m[1])
  return locs
}

async function getSitemapPaths() {
  const sitemapUrl = new URL('/sitemap.xml', BASE_URL).toString()
  try {
    const { res, text } = await fetchText(sitemapUrl)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const locs = parseSitemapLocs(text)
    const paths = []
    for (const loc of locs) {
      try {
        const u = new URL(loc)
        const base = new URL(BASE_URL)
        if (u.origin !== base.origin) continue
        // Normalize: remove trailing slash (except root)
        let p = u.pathname || '/'
        if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1)
        paths.push(p)
      } catch {
        // ignore malformed loc
      }
    }
    return uniq(paths)
  } catch (err) {
    console.warn(`[dead-links] Could not fetch sitemap at ${sitemapUrl}: ${err?.message || err}`)
    return []
  }
}

async function checkUrlStatus(url) {
  // Prefer HEAD; fall back to GET for servers that don't implement HEAD correctly.
  try {
    let res = await fetch(url, { method: 'HEAD', redirect: 'follow' })
    if (res.status === 405 || res.status === 400) {
      res = await fetch(url, { method: 'GET', redirect: 'follow' })
    }
    return res.status
  } catch {
    return 0
  }
}

async function collectPageImagesWithPlaywright(paths) {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })

  const findings = []
  try {
    for (const p of paths) {
      const page = await context.newPage()
      const url = new URL(p, BASE_URL).toString()

      const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
      const status = res?.status() ?? 0
      if (!res || status >= 400) {
        findings.push({ type: 'page', page: p, url, status })
        await page.close()
        continue
      }

      // Ensure hydration + fonts settle a bit so images with JS-added attributes appear.
      await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
      await page.evaluate(async () => {
        if (document?.fonts?.ready) await document.fonts.ready
      }).catch(() => {})

      const imgUrls = await page.evaluate(() => {
        const out = new Set()

        const add = (u) => {
          if (!u) return
          out.add(u)
        }

        for (const img of Array.from(document.images || [])) {
          add(img.currentSrc)
          add(img.src)
          const raw = img.getAttribute('srcset')
          if (raw) {
            for (const part of raw.split(',')) {
              const trimmed = part.trim()
              if (!trimmed) continue
              const url = trimmed.split(/\s+/)[0]
              if (url) add(url)
            }
          }
        }

        for (const source of Array.from(document.querySelectorAll('source[srcset]'))) {
          const raw = source.getAttribute('srcset')
          if (!raw) continue
          for (const part of raw.split(',')) {
            const trimmed = part.trim()
            if (!trimmed) continue
            const url = trimmed.split(/\s+/)[0]
            if (url) add(url)
          }
        }

        return [...out]
      })

      for (const raw of imgUrls) {
        let u
        try {
          u = new URL(raw, url)
        } catch {
          continue
        }

        // Only report same-origin by default (journal content should be local static).
        const base = new URL(BASE_URL)
        if (u.origin !== base.origin) continue

        const status = await checkUrlStatus(u.toString())
        if (status === 404) {
          findings.push({ type: 'image', page: p, url: u.pathname, status })
        } else if (status === 0) {
          findings.push({ type: 'image', page: p, url: u.pathname, status })
        }
      }

      await page.close()
    }
  } finally {
    await context.close()
    await browser.close()
  }

  return findings
}

export async function runDeadLinks() {
  const { staticRoutes, dynamicRoutes } = await collectRoutes()
  const sourceFiles = (await walk(SRC_DIR)).filter((f) => SOURCE_EXTENSIONS.has(path.extname(f)))

  const dead = []
  const missingImages = []

  for (const file of sourceFiles) {
    const content = await fs.readFile(file, 'utf8')

    for (const href of extractAttrValues(content, 'href')) {
      const p = normalizeUrlPath(href)
      if (!p || EXEMPT_PATHS.has(p)) continue

      if (isLikelyImagePath(p)) {
        const assetPath = path.join(STATIC_DIR, p.slice(1))
        if (!await fileExists(assetPath)) {
          missingImages.push({ file: path.relative(ROOT, file), src: p })
        }
      } else {
        const existsStatic = staticRoutes.has(p)
        const existsDynamic = dynamicRoutes.some((re) => re.test(p))
        if (!existsStatic && !existsDynamic) {
          dead.push({ file: path.relative(ROOT, file), href: p })
        }
      }
    }

    const imageCandidates = [
      ...extractAttrValues(content, 'src'),
      ...extractAttrValues(content, 'poster'),
      ...extractAttrValues(content, 'data-src'),
      ...extractAttrValues(content, 'data-poster'),
      ...extractCssUrlValues(content)
    ]
    for (const src of imageCandidates) {
      const p = normalizeUrlPath(src)
      if (!p) continue
      if (!isLikelyImagePath(p)) continue
      const assetPath = path.join(STATIC_DIR, p.slice(1))
      if (!await fileExists(assetPath)) {
        missingImages.push({ file: path.relative(ROOT, file), src: p })
      }
    }

    for (const srcset of extractAttrValues(content, 'srcset')) {
      for (const candidate of extractSrcsetUrls(srcset)) {
        const p = normalizeUrlPath(candidate)
        if (!p) continue
        if (!isLikelyImagePath(p)) continue
        const assetPath = path.join(STATIC_DIR, p.slice(1))
        if (!await fileExists(assetPath)) {
          missingImages.push({ file: path.relative(ROOT, file), src: p })
        }
      }
    }
  }

  // Runtime check: crawl sitemap pages and verify images actually load (no 404).
  const sitemapPaths = await getSitemapPaths()
  let runtimeFindings = []
  if (sitemapPaths.length) {
    console.log(`[dead-links] Crawling sitemap pages for runtime image 404s (${sitemapPaths.length} pages)...`)
    runtimeFindings = await collectPageImagesWithPlaywright(sitemapPaths)
  } else {
    console.log('[dead-links] No sitemap paths found; skipping runtime crawl.')
  }

  const runtimePages = runtimeFindings.filter((f) => f.type === 'page')
  const runtimeImages = runtimeFindings.filter((f) => f.type === 'image')

  if (dead.length === 0 && missingImages.length === 0 && runtimePages.length === 0 && runtimeImages.length === 0) {
    console.log('OK: no dead internal href links, missing static images, or runtime 404 images detected.')
    return
  }

  if (dead.length) {
    console.error('\nDead internal links:')
    for (const d of dead) console.error(`- ${d.href} in ${d.file}`)
  }

  if (missingImages.length) {
    console.error('\nMissing static images:')
    for (const d of missingImages) console.error(`- ${d.src} in ${d.file}`)
  }

  if (runtimePages.length) {
    console.error('\nSitemap pages returning error:')
    for (const p of runtimePages) console.error(`- ${p.page} -> HTTP ${p.status}`)
  }

  if (runtimeImages.length) {
    console.error('\nRuntime missing/broken images (from sitemap crawl):')
    for (const i of runtimeImages) console.error(`- ${i.url} on ${i.page} (HTTP ${i.status || 'ERR'})`)
  }

  throw new Error('Dead links/missing images detected.')
}
