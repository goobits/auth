import { test } from 'vitest'
import { runAdminSyncQueueSmoke } from './scripts/admin-sync-queue-smoke'

test('admin sync queue smoke', async () => {
	await runAdminSyncQueueSmoke()
}, 120_000)
