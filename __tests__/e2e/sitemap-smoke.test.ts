import { test } from 'vitest'
import { runSitemapSmoke } from './scripts/sitemap-smoke'

test('sitemap smoke', async () => {
	await runSitemapSmoke()
}, 180_000)

