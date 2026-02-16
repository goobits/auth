import { requestApi } from './http'
import { z } from 'zod'

export type AdminRulesInput = {
	hoursFrom: string
	hoursTo: string
	buffer: number
	notice: number
	capacity: number
}

export type AdminProgramInput = {
	slug: string
	label: string
	activityName: string
	pageTitle: string
	eyebrow: string
	heroTitleLine1: string
	heroTitleLine2?: string
	heroSubtitle: string
	description: string
	icon: string
	eyebrowClass?: string
	glowClass?: string
	formGlowClass?: string
	serviceStatusNote?: string
	enabled: boolean
	sortOrder: number
}

export type AdminEventCreateInput = {
	activitySlug: string
	title: string
	startsAt: string
	endsAt: string
	capacity: number
	costCents?: number
	currency?: string
	paymentProvider?: string
	paymentHandle?: string
	paymentNoteTemplate?: string
	repeatWeeks?: number
	location?: string
	note?: string
}

const AdminStatusResponseSchema = z.object({
	ok: z.literal(true),
	google: z.object({
		connected: z.boolean(),
		expired: z.boolean(),
		expiresAt: z.number().nullable()
	}),
	rules: z.object({
		hoursFrom: z.string(),
		hoursTo: z.string(),
		buffer: z.number(),
		notice: z.number(),
		capacity: z.number()
	})
})

const AdminBookingsResponseSchema = z.object({
	ok: z.literal(true),
	bookings: z.array(z.unknown()),
	stats: z.object({
		upcoming: z.number(),
		seats: z.number()
	})
})

const AdminMutationOkSchema = z.object({ ok: z.literal(true) })

const AdminProgramsResponseSchema = z.object({
	ok: z.literal(true),
	programs: z.array(z.object({
		slug: z.string(),
		href: z.string(),
		label: z.string(),
		activityName: z.string(),
		pageTitle: z.string(),
		eyebrow: z.string(),
		heroTitleLines: z.array(z.string()),
		heroSubtitle: z.string(),
		description: z.string(),
		icon: z.string(),
		eyebrowClass: z.string().optional(),
		glowClass: z.string().optional(),
		formGlowClass: z.string().optional(),
		serviceStatusNote: z.string().optional(),
		enabled: z.boolean(),
		sortOrder: z.number()
	}))
})

const AdminMeResponseSchema = z.object({
	ok: z.literal(true),
	authenticated: z.boolean(),
	user: z.object({
		id: z.union([z.string(), z.null()]),
		email: z.union([z.string(), z.null()]),
		name: z.union([z.string(), z.null()])
	}).optional()
})

const AdminEventsResponseSchema = z.object({
	ok: z.literal(true),
	upcoming: z.array(
		z.object({
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
			costCents: z.number(),
			currency: z.string(),
			paymentProvider: z.union([z.string(), z.null()]),
			paymentHandle: z.union([z.string(), z.null()]),
			paymentNoteTemplate: z.union([z.string(), z.null()]),
			recapText: z.union([z.string(), z.null()]),
			heroImageUrl: z.union([z.string(), z.null()]),
			participants: z.array(
				z.object({
					userId: z.string(),
					name: z.union([z.string(), z.null()]),
					avatarUrl: z.union([z.string(), z.null()])
				})
			)
		})
	),
	recent: z.array(
		z.object({
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
			costCents: z.number(),
			currency: z.string(),
			paymentProvider: z.union([z.string(), z.null()]),
			paymentHandle: z.union([z.string(), z.null()]),
			paymentNoteTemplate: z.union([z.string(), z.null()]),
			recapText: z.union([z.string(), z.null()]),
			heroImageUrl: z.union([z.string(), z.null()]),
			participants: z.array(
				z.object({
					userId: z.string(),
					name: z.union([z.string(), z.null()]),
					avatarUrl: z.union([z.string(), z.null()])
				})
			)
		})
	)
})

export type AdminStatusResponse = z.infer<typeof AdminStatusResponseSchema>
export type AdminBookingsResponse = z.infer<typeof AdminBookingsResponseSchema>
export type AdminMutationOk = z.infer<typeof AdminMutationOkSchema>
export type AdminMeResponse = z.infer<typeof AdminMeResponseSchema>
export type AdminProgramsResponse = z.infer<typeof AdminProgramsResponseSchema>
export type AdminEventsResponse = z.infer<typeof AdminEventsResponseSchema>

export async function getAdminStatus() {
	return requestApi<AdminStatusResponse>('/api/admin/status', {
		parse: (payload) => AdminStatusResponseSchema.parse(payload)
	})
}

export async function getAdminBookings() {
	return requestApi<AdminBookingsResponse>('/api/admin/bookings', {
		parse: (payload) => AdminBookingsResponseSchema.parse(payload)
	})
}

export async function saveAdminRules(input: AdminRulesInput) {
	return requestApi<AdminMutationOk>('/api/admin/rules', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(input),
		parse: (payload) => AdminMutationOkSchema.parse(payload)
	})
}

export async function cancelAdminBooking(bookingId: string) {
	return requestApi<AdminMutationOk>('/api/admin/cancel', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ bookingId }),
		parse: (payload) => AdminMutationOkSchema.parse(payload)
	})
}

export async function getAdminMe() {
	return requestApi<AdminMeResponse>('/api/admin/me', {
		parse: (payload) => AdminMeResponseSchema.parse(payload)
	})
}

export async function getAdminPrograms() {
	return requestApi<AdminProgramsResponse>('/api/admin/programs', {
		parse: (payload) => AdminProgramsResponseSchema.parse(payload)
	})
}

export async function setAdminProgram(input: AdminProgramInput) {
	return requestApi<AdminMutationOk>('/api/admin/programs', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ action: 'upsert', ...input }),
		parse: (payload) => AdminMutationOkSchema.parse(payload)
	})
}

export async function toggleAdminProgram(slug: string, enabled: boolean) {
	return requestApi<AdminMutationOk>('/api/admin/programs', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ action: 'toggle', slug, enabled }),
		parse: (payload) => AdminMutationOkSchema.parse(payload)
	})
}

export async function deleteAdminProgram(slug: string) {
	return requestApi<AdminMutationOk>('/api/admin/programs', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ action: 'delete', slug }),
		parse: (payload) => AdminMutationOkSchema.parse(payload)
	})
}

export async function getAdminEvents() {
	return requestApi<AdminEventsResponse>('/api/admin/events', {
		parse: (payload) => AdminEventsResponseSchema.parse(payload)
	})
}

export async function createAdminEvents(input: AdminEventCreateInput) {
	return requestApi<AdminMutationOk>('/api/admin/events', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(input),
		parse: (payload) => AdminMutationOkSchema.parse(payload)
	})
}

export async function updateAdminEventCapacity(eventId: number, capacity: number) {
	return requestApi<AdminMutationOk>(`/api/admin/events/${eventId}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ action: 'capacity', capacity }),
		parse: (payload) => AdminMutationOkSchema.parse(payload)
	})
}

export async function updateAdminEventMemory(eventId: number, input: { recapText?: string; heroImageUrl?: string }) {
	return requestApi<AdminMutationOk>(`/api/admin/events/${eventId}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			action: 'memory',
			recapText: input.recapText ?? '',
			heroImageUrl: input.heroImageUrl ?? ''
		}),
		parse: (payload) => AdminMutationOkSchema.parse(payload)
	})
}
