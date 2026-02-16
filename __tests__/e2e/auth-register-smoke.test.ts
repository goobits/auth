import { test } from 'vitest'
import { runAuthRegisterSmoke } from './scripts/auth-register-smoke'

test('auth register smoke', async () => {
	await runAuthRegisterSmoke()
}, 120_000)

