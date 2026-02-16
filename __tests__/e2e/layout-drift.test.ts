import { test } from 'vitest'
import { runLayoutDrift } from './scripts/layout-drift'

test('layout drift', async () => {
	await runLayoutDrift()
}, 180_000)

