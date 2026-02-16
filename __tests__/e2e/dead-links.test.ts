import { test } from 'vitest'
import { runDeadLinks } from './scripts/dead-links'

test('dead links and runtime image checks', async () => {
	await runDeadLinks()
}, 180_000)

