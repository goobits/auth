import {
	beginCalendarOAuth,
	buildInviteLink,
	fetchAdminEvents,
	fetchAdminPrograms,
	fetchAdminStatus,
	fetchCalendarMembersData,
	persistAdminEventCapacity,
	persistAdminEventMemory,
	persistAdminEvents,
	persistAdminProgram,
	persistAdminRules,
	persistInvite,
	removeAdminProgram,
	saveAdminProgram,
	removeInvite,
	type AdminRulesState
} from '$lib/viewmodels/admin'

export async function loadDashboardStatus() {
	const data = await fetchAdminStatus()
	return {
		connected: data.google.connected,
		connectionExpired: data.google.expired,
		connectionRefreshFailed: data.google.refreshFailed ?? false,
		rules: data.rules
	}
}

export async function loadDashboardBookings() {
	const data = await fetchAdminEvents()
	const bookings = data.upcoming.map((event) => ({
		id: event.id,
		date: new Date(event.startsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
		time: `${new Date(event.startsAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} – ${new Date(event.endsAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
		title: event.title,
		activityLabel: event.activityLabel,
		seats: event.seatsTaken,
		capacity: event.capacity,
		status: event.seatsLeft > 0 ? 'open' : 'full'
	}))
	return {
		error: '',
		bookings,
		stats: {
			upcoming: bookings.length,
			seats: bookings.reduce((sum, booking) => sum + booking.seats, 0)
		}
	}
}

export async function saveDashboardRules(input: AdminRulesState) {
	await persistAdminRules(input)
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

export async function loadAdminPrograms() {
	const data = await fetchAdminPrograms()
	return {
		error: '',
		programs: data.programs
	}
}

export async function updateAdminProgram(input: { slug: string; enabled: boolean }) {
	await persistAdminProgram(input)
	return { ok: true, error: '' }
}

export async function saveDashboardProgram(input: {
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
}) {
	await saveAdminProgram(input)
	return { ok: true, error: '' }
}

export async function deleteDashboardProgram(slug: string) {
	await removeAdminProgram(slug)
	return { ok: true, error: '' }
}

export async function loadAdminEventsData() {
	const data = await fetchAdminEvents()
	return {
		error: '',
		upcoming: data.upcoming,
		recent: data.recent
	}
}

export async function createAdminEventsBatch(input: {
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
}) {
	await persistAdminEvents(input)
	return { ok: true, error: '' }
}

export async function updateAdminEventCapacityValue(eventId: number, capacity: number) {
	await persistAdminEventCapacity(eventId, capacity)
	return { ok: true, error: '' }
}

export async function updateAdminEventMemoryValue(eventId: number, input: { recapText?: string; heroImageUrl?: string }) {
	await persistAdminEventMemory(eventId, input)
	return { ok: true, error: '' }
}

export function createInviteShareLink(origin: string, code: string) {
	return buildInviteLink(origin, code)
}
