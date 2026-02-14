import { requestApi } from './http'

export type CreateInviteInput = {
	email: string | null
	uses: number
	expiresInDays: number
}

export type CreateBookingInput = {
	start: string
	end: string
	timezone: string
	seats: number
	name: string
	email: string
	note: string
	activity: string
	idempotencyKey: string
}

export async function startCalendarOAuth() {
	return requestApi('/api/calendar/oauth-start')
}

export async function getCalendarAdminInvites() {
	return requestApi('/api/calendar/admin/invites')
}

export async function getCalendarAdminUsers() {
	return requestApi('/api/calendar/admin/users')
}

export async function createCalendarInvite(input: CreateInviteInput) {
	return requestApi('/api/calendar/admin/invites', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(input)
	})
}

export async function deleteCalendarInvite(id: string) {
	return requestApi(`/api/calendar/admin/invites?id=${encodeURIComponent(id)}`, {
		method: 'DELETE'
	})
}

export async function getCalendarAvailability(startIso: string, endIso: string) {
	const qs = new URLSearchParams({
		start: startIso,
		end: endIso
	})
	return requestApi(`/api/calendar/availability?${qs.toString()}`)
}

export async function createCalendarBooking(input: CreateBookingInput) {
	return requestApi('/api/calendar/book', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(input)
	})
}

export async function cancelCalendarBooking(cancelToken: string) {
	return requestApi('/api/calendar/cancel', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ cancelToken })
	})
}

export async function logoutCalendarSession() {
	return requestApi('/auth/logout', {
		method: 'POST',
		expectOk: false
	})
}
