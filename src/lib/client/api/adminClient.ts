import { requestApi } from './http'
import { z } from 'zod'

export type AdminRulesInput = {
	hoursFrom: string
	hoursTo: string
	buffer: number
	notice: number
	capacity: number
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

const AdminMeResponseSchema = z.object({
	ok: z.literal(true),
	authenticated: z.boolean(),
	user: z.object({
		id: z.union([z.string(), z.null()]),
		email: z.union([z.string(), z.null()]),
		name: z.union([z.string(), z.null()])
	}).optional()
})

export type AdminStatusResponse = z.infer<typeof AdminStatusResponseSchema>
export type AdminBookingsResponse = z.infer<typeof AdminBookingsResponseSchema>
export type AdminMutationOk = z.infer<typeof AdminMutationOkSchema>
export type AdminMeResponse = z.infer<typeof AdminMeResponseSchema>

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
