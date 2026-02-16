import {
	DEFAULT_ADMIN_RULES,
	DEFAULT_ADMIN_STATS
} from '$lib/viewmodels/admin'
import {
	createAdminEventsBatch,
	deleteDashboardProgram,
	getCalendarReconnectUrl,
	loadAdminEventsData,
	loadAdminPrograms,
	loadDashboardBookings,
	loadDashboardStatus,
	processDashboardSyncQueue,
	purgeDashboardSyncDeadLetters,
	retryDashboardSyncDeadLetters,
	saveDashboardProgram,
	saveDashboardRules,
	updateAdminEventCapacityValue,
	updateAdminEventMemoryValue,
	updateAdminProgram
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
	let connected = $state(false)
	let connectionExpired = $state(false)
	let connectionRefreshFailed = $state(false)
	let syncQueue = $state({
		pending: 0,
		processing: 0,
		failed: 0,
		deadLetter: 0,
		oldestPendingSeconds: 0,
		oldestDeadLetterSeconds: 0,
		hasBacklogAlert: false,
		hasDeadLetterAlert: false
	})
	let bookings = $state<unknown[]>([])
	let stats = $state(DEFAULT_ADMIN_STATS)
	let loading = $state(true)
	let error = $state('')
	let programs = $state<Array<{
		slug: string
		href: string
		label: string
		activityName: string
		pageTitle: string
		eyebrow: string
		heroTitleLines: string[]
		heroSubtitle: string
		description: string
		icon: string
		eyebrowClass?: string | undefined
		glowClass?: string | undefined
		formGlowClass?: string | undefined
		serviceStatusNote?: string | undefined
		enabled: boolean
		sortOrder: number
	}>>([])
	let programsLoading = $state(false)
	let programUpdatingSlug = $state<string | null>(null)
	let programSaving = $state(false)
	let programDeleting = $state(false)
	let selectedProgramSlug = $state<string | null>(null)
	let programDraft = $state({
		slug: '',
		label: '',
		activityName: '',
		pageTitle: '',
		eyebrow: '',
		heroTitleLine1: '',
		heroTitleLine2: '',
		heroSubtitle: '',
		description: '',
		icon: '',
		eyebrowClass: '',
		glowClass: '',
		formGlowClass: '',
		serviceStatusNote: '',
		enabled: true,
		sortOrder: 0
	})
	let events = $state<Array<{
		id: number
		activitySlug: string
		activityLabel: string
		title: string
		startsAt: string
		endsAt: string
		capacity: number
		seatsTaken: number
		seatsLeft: number
		waitlistCount: number
		costCents: number
		currency: string
		paymentProvider: string | null
		paymentHandle: string | null
		paymentNoteTemplate: string | null
		recapText: string | null
		heroImageUrl: string | null
		participants: Array<{ userId: string; name: string | null; avatarUrl: string | null }>
	}>>([])
	let recentEvents = $state<Array<{
		id: number
		activitySlug: string
		activityLabel: string
		title: string
		startsAt: string
		endsAt: string
		capacity: number
		seatsTaken: number
		seatsLeft: number
		waitlistCount: number
		costCents: number
		currency: string
		paymentProvider: string | null
		paymentHandle: string | null
		paymentNoteTemplate: string | null
		recapText: string | null
		heroImageUrl: string | null
		participants: Array<{ userId: string; name: string | null; avatarUrl: string | null }>
	}>>([])
	let eventsLoading = $state(false)
	let eventsCreating = $state(false)
	let eventUpdatingId = $state<number | null>(null)
	let syncQueueBusy = $state(false)
	let eventDraft = $state({
		activitySlug: '',
		title: '',
		startsAt: '',
		endsAt: '',
		capacity: 4,
		repeatWeeks: 0,
		costCents: 0,
		currency: 'USD',
		paymentProvider: 'venmo',
		paymentHandle: '',
		paymentNoteTemplate: '',
		location: '',
		note: ''
	})

	async function loadStatus() {
		try {
			const dashboardStatus = await loadDashboardStatus()
			connected = dashboardStatus.connected
			connectionExpired = dashboardStatus.connectionExpired
			connectionRefreshFailed = dashboardStatus.connectionRefreshFailed
			syncQueue = dashboardStatus.syncQueue ?? {
				pending: 0,
				processing: 0,
				failed: 0,
				deadLetter: 0,
				oldestPendingSeconds: 0,
				oldestDeadLetterSeconds: 0,
				hasBacklogAlert: false,
				hasDeadLetterAlert: false
			}
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

	async function loadPrograms() {
		programsLoading = true
		error = ''
		try {
			const result = await loadAdminPrograms()
			programs = result.programs
			error = result.error
			const firstProgram = programs[0]
			if (!selectedProgramSlug && firstProgram) {
				selectProgram(firstProgram.slug)
			}
			const firstEnabled = programs.find((program) => program.enabled)
			if (firstEnabled && (!eventDraft.activitySlug || !programs.some((program) => program.slug === eventDraft.activitySlug && program.enabled))) {
				eventDraft = { ...eventDraft, activitySlug: firstEnabled.slug }
			}
		} catch (err) {
			if (onUnauthorized?.(err)) return
			error = err instanceof Error ? err.message : 'Failed to load programs'
		} finally {
			programsLoading = false
		}
	}

	async function toggleProgram(slug: string, nextEnabled: boolean) {
		programUpdatingSlug = slug
		error = ''
		try {
			const result = await updateAdminProgram({ slug, enabled: nextEnabled })
			if (!result.ok) {
				error = result.error
				return
			}
			programs = programs.map((program) =>
				program.slug === slug ? { ...program, enabled: nextEnabled } : program
			)
		} catch (err) {
			if (onUnauthorized?.(err)) return
			error = err instanceof Error ? err.message : 'Failed to update program'
		} finally {
			programUpdatingSlug = null
		}
	}

	function selectProgram(slug: string) {
		const program = programs.find((item) => item.slug === slug)
		if (!program) return
		selectedProgramSlug = slug
		programDraft = {
			slug: program.slug,
			label: program.label,
			activityName: program.activityName,
			pageTitle: program.pageTitle,
			eyebrow: program.eyebrow,
			heroTitleLine1: program.heroTitleLines[0] ?? '',
			heroTitleLine2: program.heroTitleLines[1] ?? '',
			heroSubtitle: program.heroSubtitle,
			description: program.description,
			icon: program.icon,
			eyebrowClass: program.eyebrowClass ?? '',
			glowClass: program.glowClass ?? '',
			formGlowClass: program.formGlowClass ?? '',
			serviceStatusNote: program.serviceStatusNote ?? '',
			enabled: program.enabled,
			sortOrder: program.sortOrder
		}
	}

	function newProgramDraft() {
		selectedProgramSlug = null
		programDraft = {
			slug: '',
			label: '',
			activityName: '',
			pageTitle: '',
			eyebrow: '',
			heroTitleLine1: '',
			heroTitleLine2: '',
			heroSubtitle: '',
			description: '',
			icon: '✨',
			eyebrowClass: '',
			glowClass: '',
			formGlowClass: '',
			serviceStatusNote: '',
			enabled: true,
			sortOrder: (programs.at(-1)?.sortOrder ?? 0) + 10
		}
	}

	async function saveProgram() {
		programSaving = true
		error = ''
		try {
			const result = await saveDashboardProgram({
				slug: programDraft.slug.trim(),
				label: programDraft.label.trim(),
				activityName: programDraft.activityName.trim(),
				pageTitle: programDraft.pageTitle.trim(),
				eyebrow: programDraft.eyebrow.trim(),
				heroTitleLine1: programDraft.heroTitleLine1.trim(),
				heroTitleLine2: programDraft.heroTitleLine2.trim(),
				heroSubtitle: programDraft.heroSubtitle.trim(),
				description: programDraft.description.trim(),
				icon: programDraft.icon.trim(),
				eyebrowClass: programDraft.eyebrowClass.trim(),
				glowClass: programDraft.glowClass.trim(),
				formGlowClass: programDraft.formGlowClass.trim(),
				serviceStatusNote: programDraft.serviceStatusNote.trim(),
				enabled: programDraft.enabled,
				sortOrder: programDraft.sortOrder
			})
			if (!result.ok) {
				error = result.error
				return
			}
			await loadPrograms()
			selectProgram(programDraft.slug.trim())
		} catch (err) {
			if (onUnauthorized?.(err)) return
			error = err instanceof Error ? err.message : 'Failed to save program'
		} finally {
			programSaving = false
		}
	}

	async function deleteProgram() {
		const slug = selectedProgramSlug
		if (!slug) return
		if (!confirm(`Delete program "${slug}"?`)) return
		programDeleting = true
		error = ''
		try {
			const result = await deleteDashboardProgram(slug)
			if (!result.ok) {
				error = result.error
				return
			}
			await loadPrograms()
			const firstProgram = programs[0]
			if (firstProgram) selectProgram(firstProgram.slug)
			else newProgramDraft()
		} catch (err) {
			if (onUnauthorized?.(err)) return
			error = err instanceof Error ? err.message : 'Failed to delete program'
		} finally {
			programDeleting = false
		}
	}

	async function loadEvents() {
		eventsLoading = true
		error = ''
		try {
			const result = await loadAdminEventsData()
			events = result.upcoming
			recentEvents = result.recent
			error = result.error
		} catch (err) {
			if (onUnauthorized?.(err)) return
			error = err instanceof Error ? err.message : 'Failed to load events'
		} finally {
			eventsLoading = false
		}
	}

	async function createEvents() {
		eventsCreating = true
		error = ''
		try {
			if (!eventDraft.activitySlug) {
				error = 'Select a program before creating events.'
				return
			}
			if (!eventDraft.title || !eventDraft.startsAt || !eventDraft.endsAt) {
				error = 'Title, start, and end are required.'
				return
			}
			const result = await createAdminEventsBatch({ ...eventDraft })
			if (!result.ok) {
				error = result.error
				return
			}
			eventDraft = {
				...eventDraft,
				title: '',
				location: '',
				note: '',
				repeatWeeks: 0,
				costCents: 0,
				paymentHandle: '',
				paymentNoteTemplate: ''
			}
			await loadEvents()
		} catch (err) {
			if (onUnauthorized?.(err)) return
			error = err instanceof Error ? err.message : 'Failed to create events'
		} finally {
			eventsCreating = false
		}
	}

	async function updateEventCapacity(eventId: number, capacity: number) {
		eventUpdatingId = eventId
		error = ''
		try {
			const result = await updateAdminEventCapacityValue(eventId, capacity)
			if (!result.ok) {
				error = result.error
				return
			}
			events = events.map((event) =>
				event.id === eventId ? { ...event, capacity } : event
			)
		} catch (err) {
			if (onUnauthorized?.(err)) return
			error = err instanceof Error ? err.message : 'Failed to update event capacity'
		} finally {
			eventUpdatingId = null
		}
	}

	async function updateEventMemory(eventId: number, recapText: string, heroImageUrl: string) {
		eventUpdatingId = eventId
		error = ''
		try {
			const result = await updateAdminEventMemoryValue(eventId, { recapText, heroImageUrl })
			if (!result.ok) {
				error = result.error
				return
			}
			recentEvents = recentEvents.map((event) =>
				event.id === eventId ? { ...event, recapText, heroImageUrl } : event
			)
		} catch (err) {
			if (onUnauthorized?.(err)) return
			error = err instanceof Error ? err.message : 'Failed to update event memory'
		} finally {
			eventUpdatingId = null
		}
	}

	async function processSyncQueue() {
		syncQueueBusy = true
		error = ''
		try {
			const result = await processDashboardSyncQueue(20)
			if (!result.ok) {
				error = result.error
				return
			}
			await loadStatus()
		} catch (err) {
			if (onUnauthorized?.(err)) return
			error = err instanceof Error ? err.message : 'Failed to process sync queue'
		} finally {
			syncQueueBusy = false
		}
	}

	async function retryDeadLetters() {
		syncQueueBusy = true
		error = ''
		try {
			const result = await retryDashboardSyncDeadLetters(20)
			if (!result.ok) {
				error = result.error
				return
			}
			await loadStatus()
		} catch (err) {
			if (onUnauthorized?.(err)) return
			error = err instanceof Error ? err.message : 'Failed to requeue dead-letter jobs'
		} finally {
			syncQueueBusy = false
		}
	}

	async function purgeDeadLetters() {
		if (!confirm('Purge dead-letter sync jobs? This discards failed jobs permanently.')) return
		syncQueueBusy = true
		error = ''
		try {
			const result = await purgeDashboardSyncDeadLetters(100)
			if (!result.ok) {
				error = result.error
				return
			}
			await loadStatus()
		} catch (err) {
			if (onUnauthorized?.(err)) return
			error = err instanceof Error ? err.message : 'Failed to purge dead-letter jobs'
		} finally {
			syncQueueBusy = false
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
		get connected() { return connected },
		get connectionExpired() { return connectionExpired },
		get connectionRefreshFailed() { return connectionRefreshFailed },
		get syncQueue() { return syncQueue },
		get bookings() { return bookings },
		get stats() { return stats },
		get loading() { return loading },
		get error() { return error },
		get programs() { return programs },
		get programsLoading() { return programsLoading },
		get programUpdatingSlug() { return programUpdatingSlug },
		get selectedProgramSlug() { return selectedProgramSlug },
		get programDraft() { return programDraft },
		set programDraft(value) { programDraft = value },
		get programSaving() { return programSaving },
		get programDeleting() { return programDeleting },
		get events() { return events },
		get enabledPrograms() { return programs.filter((program) => program.enabled) },
		get eventsLoading() { return eventsLoading },
		get eventsCreating() { return eventsCreating },
		get eventUpdatingId() { return eventUpdatingId },
		get syncQueueBusy() { return syncQueueBusy },
		get recentEvents() { return recentEvents },
		get eventDraft() { return eventDraft },
		set eventDraft(value) { eventDraft = value },
		loadStatus,
		loadBookings,
		loadPrograms,
		loadEvents,
		save,
		reconnect,
		toggleProgram,
		selectProgram,
		newProgramDraft,
		saveProgram,
		deleteProgram,
		createEvents,
		updateEventCapacity,
		updateEventMemory,
		processSyncQueue,
		retryDeadLetters,
		purgeDeadLetters
	}
}
