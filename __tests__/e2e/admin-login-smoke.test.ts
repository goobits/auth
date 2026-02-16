import { test } from 'vitest'
import { runAdminLoginSmoke } from './scripts/admin-login-smoke'

test('admin login smoke', async () => {
	await runAdminLoginSmoke()
}, 120_000)

