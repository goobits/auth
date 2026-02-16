import { test } from 'vitest'
import { runCalendarEventsFlow } from './scripts/calendar-events-flow'

test('calendar events flow', async () => {
	await runCalendarEventsFlow()
}, 120_000)
