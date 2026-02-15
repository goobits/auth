import {
	beginCalendarOAuth,
	buildInviteLink,
	fetchAdminBookings,
	fetchAdminStatus,
	fetchCalendarMembersData,
	persistAdminRules,
	persistInvite,
	removeAdminBooking,
	removeInvite,
	type AdminRulesState
} from '$lib/viewmodels/admin'

export async function loadDashboardStatus() {
	const data = await fetchAdminStatus()
	return {
		connected: data.google.connected,
		connectionExpired: data.google.expired,
		rules: data.rules
	}
}

export async function loadDashboardBookings() {
	const data = await fetchAdminBookings()
	return {
		error: '',
		bookings: data.bookings,
		stats: data.stats
	}
}

export async function saveDashboardRules(input: AdminRulesState) {
	await persistAdminRules(input)
	return { ok: true, error: '' }
}

export async function cancelDashboardBooking(bookingId: string) {
	await removeAdminBooking(bookingId)
	return { ok: true, error: '' }
}

export async function loadMembersData() {
	const { invitesData, usersData } = await fetchCalendarMembersData()

	return {
		invites: invitesData.invites,
		users: usersData.users,
		error: ''
	}
}

export async function createMemberInvite(input: { email: string | null, uses: number, expiresInDays: number }) {
	await persistInvite(input)
	return { ok: true, error: '' }
}

export async function deleteMemberInvite(id: string) {
	await removeInvite(id)
	return { ok: true, error: '' }
}

export async function getCalendarReconnectUrl() {
	const data = await beginCalendarOAuth()
	return { ok: true, authUrl: data.authUrl, error: '' }
}

export function createInviteShareLink(origin: string, code: string) {
	return buildInviteLink(origin, code)
}
