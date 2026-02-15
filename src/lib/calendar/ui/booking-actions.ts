import { cancelCalendarBooking, createCalendarBooking, getCalendarAvailability } from '$lib/client/api/calendarClient'
import type { BookingSlot } from './booking-state'
import { getMonthRange } from './booking-state'

type CreateBookingParams = {
	selectedSlot: BookingSlot
	timeZone: string
	seats: number
	name: string
	email: string
	note: string
	activityName: string
}

export async function loadAvailabilityForMonth(currentMonth: Date) {
	const { start, end } = getMonthRange(currentMonth)
	const data = await getCalendarAvailability(start.toISOString(), end.toISOString())
	return data.slots
}

export async function submitBooking(params: CreateBookingParams) {
	const data = await createCalendarBooking({
		start: params.selectedSlot.start,
		end: params.selectedSlot.end,
		timezone: params.timeZone,
		seats: params.seats,
		name: params.name,
		email: params.email,
		note: params.note,
		activity: params.activityName,
		idempotencyKey: crypto.randomUUID()
	})

	return {
		eventLink: data.eventLink || '',
		cancelToken: data.cancelToken || ''
	}
}

export async function submitCancel(cancelToken: string) {
	await cancelCalendarBooking(cancelToken)
}

export function getErrorMessage(error: unknown, fallback: string) {
	if (error instanceof Error && error.message) return error.message
	return fallback
}

export function readCancelTokenFromSearch(search: string) {
	const params = new URLSearchParams(search)
	return params.get('cancel') || ''
}

export function buildCancelLink(currentHref: string, cancelToken: string) {
	const url = new URL(currentHref)
	url.searchParams.set('cancel', cancelToken)
	return url.toString()
}
