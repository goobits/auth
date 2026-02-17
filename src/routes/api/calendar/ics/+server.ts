import type { RequestEvent } from '@sveltejs/kit'
import { buildEnv } from '../_bridge.ts'
import { listUpcomingEvents } from '@miko/calendar'
import { getCalendarUserId } from '../_auth.ts'

function escapeIcsText(value: string) {
	return value
		.replace(/\\/g, '\\\\')
		.replace(/\n/g, '\\n')
		.replace(/,/g, '\\,')
		.replace(/;/g, '\\;')
}

function toIcsDate(value: string) {
	return value.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

export async function GET(event: RequestEvent) {
	const userId = getCalendarUserId(event)
	if (!userId) {
		return new Response('Unauthorized', { status: 401 })
	}

	const env = await buildEnv(event.platform)
	const events = await listUpcomingEvents(env.DB, userId, true)

	const lines = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//MIKO.ART//Calendar Social//EN',
		'CALSCALE:GREGORIAN'
	]

	for (const eventItem of events) {
		if (eventItem.userStatus !== 'joined') continue
		lines.push('BEGIN:VEVENT')
		lines.push(`UID:miko-calendar-${eventItem.id}@miko.art`)
		lines.push(`DTSTAMP:${toIcsDate(new Date().toISOString())}`)
		lines.push(`DTSTART:${toIcsDate(eventItem.startsAt)}`)
		lines.push(`DTEND:${toIcsDate(eventItem.endsAt)}`)
		lines.push(`SUMMARY:${escapeIcsText(eventItem.title)}`)
		lines.push(`DESCRIPTION:${escapeIcsText(`${eventItem.activityLabel} session`)}`)
		if (eventItem.location) lines.push(`LOCATION:${escapeIcsText(eventItem.location)}`)
		lines.push('END:VEVENT')
	}
	lines.push('END:VCALENDAR')

	return new Response(lines.join('\r\n'), {
		headers: {
			'Content-Type': 'text/calendar; charset=utf-8',
			'Content-Disposition': 'inline; filename="miko-events.ics"',
			'Cache-Control': 'no-store, max-age=0'
		}
	})
}
