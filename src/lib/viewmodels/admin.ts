import {
	createAdminEvents,
	disconnectAdminGoogleIntegration,
	deleteAdminProgram,
	getAdminEvents,
	getAdminPrograms,
	getAdminStatus,
	saveAdminRules,
	setAdminProgram,
	toggleAdminProgram,
	mutateAdminSyncQueue,
	updateAdminEventMemory,
	updateAdminEventCapacity,
	type AdminRulesInput
} from '$lib/client/api/adminClient'
import {
	createCalendarInvite,
	deleteCalendarInvite,
	getCalendarAdminInvites,
	getCalendarAdminUsers,
	startCalendarOAuth,
	type CreateInviteInput
} from '$lib/client/api/calendarClient'

export type AdminTabId = 'dash' | 'cal' | 'events' | 'programs' | 'calendar-auth' | 'integrations'

export type AdminNavItem = {
	label: string
	id: AdminTabId
}

export type AdminHours = {
	from: string
	to: string
}

export type AdminBookingStats = {
	upcoming: number
	seats: number
}

export type AdminRulesState = {
	hours: AdminHours
	buffer: number
	notice: number
	capacity: number
}

export const ADMIN_NAV: AdminNavItem[] = [
	{ label: 'Overview', id: 'dash' },
	{ label: 'Availability', id: 'cal' },
	{ label: 'Events', id: 'events' },
	{ label: 'Programs', id: 'programs' },
	{ label: 'Members', id: 'calendar-auth' },
	{ label: 'Integrations', id: 'integrations' }
]

const ADMIN_TAB_SEGMENTS: Record<AdminTabId, string> = {
	dash: 'overview',
	cal: 'availability',
	events: 'events',
	programs: 'programs',
	'calendar-auth': 'members',
	integrations: 'integrations'
}

export function getAdminTabHref(tab: AdminTabId) {
	const segment = ADMIN_TAB_SEGMENTS[tab]
	return segment ? `/admin/${segment}` : '/admin'
}

export function isAdminTabId(value: string): value is AdminTabId {
	return value === 'dash' ||
		value === 'cal' ||
		value === 'events' ||
		value === 'programs' ||
		value === 'calendar-auth' ||
		value === 'integrations'
}

export const DEFAULT_ADMIN_RULES: AdminRulesState = {
	hours: { from: '06:00', to: '22:00' },
	buffer: 15,
	notice: 24,
	capacity: 4
}

export const DEFAULT_ADMIN_STATS: AdminBookingStats = {
	upcoming: 0,
	seats: 0
}

export const DEFAULT_INVITE_DRAFT: CreateInviteInput = {
	email: null,
	uses: 1,
	expiresInDays: 7
}

export function formatAdminDate(timestamp?: number | null) {
	if (!timestamp) return 'Never'
	return new Date(timestamp * 1000).toLocaleDateString()
}

export function buildInviteLink(origin: string, code: string) {
	return `${origin}/calendar/login?invite=${code}`
}

export function normalizeRulesInput(state: AdminRulesState): AdminRulesInput {
	return {
		hoursFrom: state.hours.from,
		hoursTo: state.hours.to,
		buffer: state.buffer,
		notice: state.notice,
		capacity: state.capacity
	}
}

export async function fetchAdminStatus() {
	return getAdminStatus()
}

export async function persistAdminRules(state: AdminRulesState) {
	return saveAdminRules(normalizeRulesInput(state))
}

export async function beginCalendarOAuth() {
	return startCalendarOAuth()
}

export async function disconnectCalendarOAuth() {
	return disconnectAdminGoogleIntegration()
}

export async function fetchAdminPrograms() {
	return getAdminPrograms()
}

export async function persistAdminProgram(input: { slug: string; enabled: boolean }) {
	return toggleAdminProgram(input.slug, input.enabled)
}

export async function saveAdminProgram(input: {
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
	return setAdminProgram(input)
}

export async function removeAdminProgram(slug: string) {
	return deleteAdminProgram(slug)
}

export async function fetchAdminEvents() {
	return getAdminEvents()
}

export async function persistAdminEvents(input: {
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
	return createAdminEvents(input)
}

export async function persistAdminEventCapacity(eventId: number, capacity: number) {
	return updateAdminEventCapacity(eventId, capacity)
}

export async function persistAdminEventMemory(eventId: number, input: { recapText?: string; heroImageUrl?: string }) {
	return updateAdminEventMemory(eventId, input)
}

export async function processAdminSyncQueue(limit = 10) {
	return mutateAdminSyncQueue('process', limit)
}

export async function retryAdminSyncDeadLetters(limit = 10) {
	return mutateAdminSyncQueue('retry_dead_letters', limit)
}

export async function purgeAdminSyncDeadLetters(limit = 10) {
	return mutateAdminSyncQueue('purge_dead_letters', limit)
}

export async function fetchCalendarMembersData() {
	const [invitesData, usersData] = await Promise.all([getCalendarAdminInvites(), getCalendarAdminUsers()])
	return { invitesData, usersData }
}

export async function persistInvite(input: CreateInviteInput) {
	return createCalendarInvite(input)
}

export async function removeInvite(id: string) {
	return deleteCalendarInvite(id)
}

export function getApiErrorMessage(data: unknown, fallback: string) {
	if (
		typeof data === 'object' &&
		data !== null &&
		'error' in data &&
		typeof (data as { error?: { message?: unknown } }).error?.message === 'string'
	) {
		return (data as { error: { message: string } }).error.message
	}
	return fallback
}
