import { test } from 'vitest'
import { runLayoutShift } from './scripts/layout-shift'

test('layout shift (cls)', async () => {
	await runLayoutShift()
}, 180_000)

