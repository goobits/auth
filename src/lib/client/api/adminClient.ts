import { requestApi } from './http'

export type AdminRulesInput = {
	hoursFrom: string
	hoursTo: string
	buffer: number
	notice: number
	capacity: number
}

export async function getAdminStatus() {
	return requestApi('/api/admin/status')
}

export async function getAdminBookings() {
	return requestApi('/api/admin/bookings')
}

export async function saveAdminRules(input: AdminRulesInput) {
	return requestApi('/api/admin/rules', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(input)
	})
}

export async function cancelAdminBooking(bookingId: string) {
	return requestApi('/api/admin/cancel', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ bookingId })
	})
}

export async function getAdminMe() {
	return requestApi('/api/admin/me')
}
