import {
	DEFAULT_ADMIN_RULES,
	DEFAULT_ADMIN_STATS
} from '$lib/viewmodels/admin'
import {
	cancelDashboardBooking,
	getCalendarReconnectUrl,
	loadDashboardBookings,
	loadDashboardStatus,
	saveDashboardRules
} from '$lib/viewmodels/admin-dashboard'

type UnauthorizedHandler = (error: unknown) => boolean

type DashboardControllerOptions = {
	onUnauthorized?: UnauthorizedHandler
}

export function createAdminDashboardController(options: DashboardControllerOptions = {}) {
	const { onUnauthorized } = options

	let hours = $state({ ...DEFAULT_ADMIN_RULES.hours })
	let buffer = $state(DEFAULT_ADMIN_RULES.buffer)
	let notice = $state(DEFAULT_ADMIN_RULES.notice)
	let capacity = $state(DEFAULT_ADMIN_RULES.capacity)
	let saved = $state(false)
	let saving = $state(false)
	let canceling = $state(false)
	let viewBooking = $state(null)
	let hover = $state<number | null>(null)
	let connected = $state(false)
	let connectionExpired = $state(false)
	let bookings = $state<unknown[]>([])
	let stats = $state(DEFAULT_ADMIN_STATS)
	let loading = $state(true)
	let error = $state('')

	async function loadStatus() {
		try {
			const dashboardStatus = await loadDashboardStatus()
			connected = dashboardStatus.connected
			connectionExpired = dashboardStatus.connectionExpired
			if (dashboardStatus.rules) {
				hours = { from: dashboardStatus.rules.hoursFrom, to: dashboardStatus.rules.hoursTo }
				buffer = dashboardStatus.rules.buffer
				notice = dashboardStatus.rules.notice
				capacity = dashboardStatus.rules.capacity
			}
		} catch (err) {
			if (onUnauthorized?.(err)) return
			console.error('Failed to load status:', err)
		}
	}

	async function loadBookings() {
		loading = true
		error = ''
		try {
			const dashboardBookings = await loadDashboardBookings()
			bookings = dashboardBookings.bookings
			stats = dashboardBookings.stats || DEFAULT_ADMIN_STATS
			error = dashboardBookings.error
		} catch (err) {
			if (onUnauthorized?.(err)) return
			error = err instanceof Error ? err.message : 'Failed to load bookings'
		} finally {
			loading = false
		}
	}

	async function save() {
		saving = true
		try {
			const saveResult = await saveDashboardRules({ hours: { ...hours }, buffer, notice, capacity })
			if (saveResult.ok) {
				saved = true
				setTimeout(() => {
					saved = false
				}, 2200)
			} else {
				error = saveResult.error
			}
		} catch (err) {
			if (onUnauthorized?.(err)) return
			error = err instanceof Error ? err.message : 'Failed to save rules'
		} finally {
			saving = false
		}
	}

	async function cancelBooking(bookingId: string) {
		if (!confirm('Are you sure you want to cancel this booking?')) return
		canceling = true
		try {
			const cancellationResult = await cancelDashboardBooking(bookingId)
			if (cancellationResult.ok) {
				viewBooking = null
				await loadBookings()
			} else {
				error = cancellationResult.error
			}
		} catch (err) {
			if (onUnauthorized?.(err)) return
			error = err instanceof Error ? err.message : 'Failed to cancel booking'
		} finally {
			canceling = false
		}
	}

	async function reconnect() {
		try {
			const reconnectResult = await getCalendarReconnectUrl()
			if (reconnectResult.ok) {
				window.location.href = reconnectResult.authUrl
			} else {
				error = reconnectResult.error
			}
		} catch (err) {
			if (onUnauthorized?.(err)) return
			error = err instanceof Error ? err.message : 'Failed to connect to Google'
		}
	}

	return {
		get hours() { return hours },
		set hours(value) { hours = value },
		get buffer() { return buffer },
		set buffer(value) { buffer = value },
		get notice() { return notice },
		set notice(value) { notice = value },
		get capacity() { return capacity },
		set capacity(value) { capacity = value },
		get saved() { return saved },
		get saving() { return saving },
		get canceling() { return canceling },
		get viewBooking() { return viewBooking },
		set viewBooking(value) { viewBooking = value },
		get hover() { return hover },
		set hover(value) { hover = value },
		get connected() { return connected },
		get connectionExpired() { return connectionExpired },
		get bookings() { return bookings },
		get stats() { return stats },
		get loading() { return loading },
		get error() { return error },
		loadStatus,
		loadBookings,
		save,
		cancelBooking,
		reconnect
	}
}
