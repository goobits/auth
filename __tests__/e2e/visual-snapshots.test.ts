import { test } from 'vitest'
import { runVisualSnapshots } from './scripts/visual-snapshots'

test('visual snapshots', async () => {
	await runVisualSnapshots()
}, 300_000)

