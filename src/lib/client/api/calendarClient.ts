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

const CalendarAvailabilityErrorSchema = z.object({
	code: z.string(),
	message: z.string()
})

const CalendarAvailabilityResponseSchema = z.object({
	slots: z.array(CalendarAvailabilitySlotSchema),
	error: CalendarAvailabilityErrorSchema.optional()
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

const CalendarFeedEventSchema = z.object({
	id: z.number(),
	activitySlug: z.string(),
	activityLabel: z.string(),
	title: z.string(),
	startsAt: z.string(),
	endsAt: z.string(),
	capacity: z.number(),
	seatsTaken: z.number(),
	seatsLeft: z.number(),
	waitlistCount: z.number(),
	userStatus: z.union([z.literal('joined'), z.literal('waitlist'), z.null()]),
	userGuestCount: z.number(),
	location: z.union([z.string(), z.null()]),
	note: z.union([z.string(), z.null()]),
	costCents: z.number(),
	currency: z.string(),
	paymentProvider: z.union([z.string(), z.null()]),
	paymentHandle: z.union([z.string(), z.null()]),
	paymentNoteTemplate: z.union([z.string(), z.null()]),
	recapText: z.union([z.string(), z.null()]),
	heroImageUrl: z.union([z.string(), z.null()]),
	payUrl: z.union([z.string(), z.null()]).optional(),
	participants: z.array(
		z.object({
			userId: z.string(),
			name: z.union([z.string(), z.null()]),
			avatarUrl: z.union([z.string(), z.null()])
		})
	)
})

const CalendarEventsResponseSchema = z.object({
	ok: z.literal(true),
	upcoming: z.array(CalendarFeedEventSchema),
	recent: z.array(CalendarFeedEventSchema)
})

const CalendarJoinResponseSchema = z.object({
	ok: z.literal(true),
	status: z.union([z.literal('joined'), z.literal('waitlist')])
})

const CalendarProfileSchema = z.object({
	emergencyContact: z.string(),
	dietaryRestrictions: z.string(),
	chatHandle: z.string()
})

const CalendarProfileResponseSchema = z.object({
	ok: z.literal(true),
	profile: CalendarProfileSchema
})

export type CalendarOAuthStartResponse = z.infer<typeof CalendarOAuthStartResponseSchema>
export type CalendarAvailabilityResponse = z.infer<typeof CalendarAvailabilityResponseSchema>
export type CalendarBookingResponse = z.infer<typeof CalendarBookingResponseSchema>
export type CalendarCancelResponse = z.infer<typeof CalendarCancelResponseSchema>
export type CalendarInvitesResponse = z.infer<typeof CalendarInvitesResponseSchema>
export type CalendarUsersResponse = z.infer<typeof CalendarUsersResponseSchema>
export type CalendarEventsResponse = z.infer<typeof CalendarEventsResponseSchema>
export type CalendarJoinResponse = z.infer<typeof CalendarJoinResponseSchema>
export type CalendarProfile = z.infer<typeof CalendarProfileSchema>

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

export async function getCalendarEvents(input: { mine?: boolean } = {}) {
	const qs = new URLSearchParams()
	if (input.mine) qs.set('mine', '1')
	return requestApi<CalendarEventsResponse>(`/api/calendar/events${qs.size > 0 ? `?${qs.toString()}` : ''}`, {
		parse: (payload) => CalendarEventsResponseSchema.parse(payload)
	})
}

export async function joinCalendarEvent(eventId: number, input: { guestCount?: number; note?: string } = {}) {
	return requestApi<CalendarJoinResponse>(`/api/calendar/events/${eventId}/join`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(input),
		parse: (payload) => CalendarJoinResponseSchema.parse(payload)
	})
}

export async function leaveCalendarEvent(eventId: number) {
	return requestApi<CalendarCancelResponse>(`/api/calendar/events/${eventId}/leave`, {
		method: 'POST',
		parse: (payload) => CalendarCancelResponseSchema.parse(payload)
	})
}

export async function getCalendarProfile() {
	return requestApi<CalendarProfileResponse>(`/api/calendar/profile`, {
		parse: (payload) => CalendarProfileResponseSchema.parse(payload)
	})
}

type CalendarProfileResponse = z.infer<typeof CalendarProfileResponseSchema>

export async function saveCalendarProfile(input: CalendarProfile) {
	return requestApi<CalendarCancelResponse>(`/api/calendar/profile`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(input),
		parse: (payload) => CalendarCancelResponseSchema.parse(payload)
	})
}
