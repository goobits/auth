import {
	beginCalendarOAuth,
	buildInviteLink,
	DEFAULT_ADMIN_STATS,
	fetchAdminBookings,
	fetchAdminStatus,
	fetchCalendarMembersData,
	getApiErrorMessage,
	persistAdminRules,
	persistInvite,
	removeAdminBooking,
	removeInvite,
	type AdminRulesState
} from '$lib/viewmodels/admin'

export async function loadDashboardStatus() {
	const data = await fetchAdminStatus()
	return {
		connected: data.google?.connected ?? false,
		connectionExpired: data.google?.expired ?? false,
		rules: data.rules
	}
}

export async function loadDashboardBookings() {
	const data = await fetchAdminBookings()
	if (!data.ok) {
		return {
			error: getApiErrorMessage(data, 'Failed to load bookings'),
			bookings: [],
			stats: DEFAULT_ADMIN_STATS
		}
	}

	return {
		error: '',
		bookings: data.bookings || [],
		stats: data.stats || DEFAULT_ADMIN_STATS
	}
}

export async function saveDashboardRules(input: AdminRulesState) {
	const data = await persistAdminRules(input)
	if (!data.ok) {
		return { ok: false, error: getApiErrorMessage(data, 'Failed to save rules') }
	}
	return { ok: true, error: '' }
}

export async function cancelDashboardBooking(bookingId: string) {
	const data = await removeAdminBooking(bookingId)
	if (!data.ok) {
		return { ok: false, error: getApiErrorMessage(data, 'Failed to cancel booking') }
	}
	return { ok: true, error: '' }
}

export async function loadMembersData() {
	const { invitesData, usersData } = await fetchCalendarMembersData()

	return {
		invites: invitesData.ok ? invitesData.invites || [] : [],
		users: usersData.ok ? usersData.users || [] : [],
		error: !invitesData.ok
			? getApiErrorMessage(invitesData, 'Failed to load invites')
			: !usersData.ok
				? getApiErrorMessage(usersData, 'Failed to load users')
				: ''
	}
}

export async function createMemberInvite(input: { email: string | null, uses: number, expiresInDays: number }) {
	const data = await persistInvite(input)
	if (!data.ok) {
		return { ok: false, error: getApiErrorMessage(data, 'Failed to create invite') }
	}
	return { ok: true, error: '' }
}

export async function deleteMemberInvite(id: string) {
	const data = await removeInvite(id)
	if (!data.ok) {
		return { ok: false, error: getApiErrorMessage(data, 'Failed to delete invite') }
	}
	return { ok: true, error: '' }
}

export async function getCalendarReconnectUrl() {
	const data = await beginCalendarOAuth()
	if (!data.authUrl) {
		return { ok: false, authUrl: '', error: getApiErrorMessage(data, 'Failed to connect to Google') }
	}
	return { ok: true, authUrl: data.authUrl, error: '' }
}

export function createInviteShareLink(origin: string, code: string) {
	return buildInviteLink(origin, code)
}
