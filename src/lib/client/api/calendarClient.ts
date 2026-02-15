import { requestApi } from './http'
import { z } from 'zod'

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

const CalendarOAuthStartResponseSchema = z.object({
	authUrl: z.string()
})

const CalendarAvailabilitySlotSchema = z.object({
	start: z.string(),
	end: z.string(),
	available: z.boolean(),
	remaining: z.number()
})

const CalendarAvailabilityResponseSchema = z.object({
	slots: z.array(CalendarAvailabilitySlotSchema)
})

const CalendarBookingResponseSchema = z.object({
	ok: z.literal(true),
	eventLink: z.string().optional(),
	cancelToken: z.string().optional()
})

const CalendarCancelResponseSchema = z.object({
	ok: z.literal(true)
})

const CalendarInvitesResponseSchema = z.object({
	ok: z.literal(true),
	invites: z.array(z.unknown())
})

const CalendarUsersResponseSchema = z.object({
	ok: z.literal(true),
	users: z.array(z.unknown())
})

export type CalendarOAuthStartResponse = z.infer<typeof CalendarOAuthStartResponseSchema>
export type CalendarAvailabilityResponse = z.infer<typeof CalendarAvailabilityResponseSchema>
export type CalendarBookingResponse = z.infer<typeof CalendarBookingResponseSchema>
export type CalendarCancelResponse = z.infer<typeof CalendarCancelResponseSchema>
export type CalendarInvitesResponse = z.infer<typeof CalendarInvitesResponseSchema>
export type CalendarUsersResponse = z.infer<typeof CalendarUsersResponseSchema>

export async function startCalendarOAuth() {
	return requestApi<CalendarOAuthStartResponse>('/api/calendar/oauth-start', {
		parse: (payload) => CalendarOAuthStartResponseSchema.parse(payload)
	})
}

export async function getCalendarAdminInvites() {
	return requestApi<CalendarInvitesResponse>('/api/calendar/admin/invites', {
		parse: (payload) => CalendarInvitesResponseSchema.parse(payload)
	})
}

export async function getCalendarAdminUsers() {
	return requestApi<CalendarUsersResponse>('/api/calendar/admin/users', {
		parse: (payload) => CalendarUsersResponseSchema.parse(payload)
	})
}

export async function createCalendarInvite(input: CreateInviteInput) {
	return requestApi<CalendarInvitesResponse>('/api/calendar/admin/invites', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(input),
		parse: (payload) => CalendarInvitesResponseSchema.parse(payload)
	})
}

export async function deleteCalendarInvite(id: string) {
	return requestApi<CalendarInvitesResponse>(`/api/calendar/admin/invites?id=${encodeURIComponent(id)}`, {
		method: 'DELETE',
		parse: (payload) => CalendarInvitesResponseSchema.parse(payload)
	})
}

export async function getCalendarAvailability(startIso: string, endIso: string) {
	const qs = new URLSearchParams({
		start: startIso,
		end: endIso
	})
	return requestApi<CalendarAvailabilityResponse>(`/api/calendar/availability?${qs.toString()}`, {
		parse: (payload) => CalendarAvailabilityResponseSchema.parse(payload)
	})
}

export async function createCalendarBooking(input: CreateBookingInput) {
	return requestApi<CalendarBookingResponse>('/api/calendar/book', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(input),
		parse: (payload) => CalendarBookingResponseSchema.parse(payload)
	})
}

export async function cancelCalendarBooking(cancelToken: string) {
	return requestApi<CalendarCancelResponse>('/api/calendar/cancel', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ cancelToken }),
		parse: (payload) => CalendarCancelResponseSchema.parse(payload)
	})
}

export async function logoutCalendarSession() {
	return requestApi('/auth/logout', {
		method: 'POST',
		expectOk: false
	})
}
