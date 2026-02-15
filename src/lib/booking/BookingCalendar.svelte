<script lang="ts">
	import { onMount } from 'svelte'
	import {
		buildCancelLink,
		getErrorMessage,
		loadAvailabilityForMonth,
		readCancelTokenFromSearch,
		submitBooking,
		submitCancel
	} from '$lib/calendar/ui/booking-actions'
	import {
		formatFullDay,
		formatMonthYear,
		formatTime,
		getAvailableCount,
		getCalendarDays,
		getSlotsForDate,
		isPast,
		isSameDay,
		isToday,
		type BookingField,
		type BookingFieldErrors,
		type BookingSlot,
		type CalendarDay,
		validateBookingForm
	} from '$lib/calendar/ui/booking-state'

	let { activityName = 'Activity', glowClass = '' } = $props()

	let slots = $state<BookingSlot[]>([])
	let loading = $state(true)
	let error = $state('')
	let currentMonth = $state(new Date())
	let selectedDate = $state<Date | null>(null)
	let selectedSlot = $state<BookingSlot | null>(null)
	let name = $state('')
	let email = $state('')
	let seats = $state(1)
	let note = $state('')
	let status = $state('')
	let eventLink = $state('')
	let formEl = $state<HTMLElement | null>(null)
	let fieldErrors = $state<BookingFieldErrors>({})
	let touched = $state<Partial<Record<BookingField, boolean>>>({})
	let cancelToken = $state('')
	let cancelStatus = $state('')
	let canceling = $state(false)
	let showCancelModal = $state(false)

	const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
	const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

	function validateForm() {
		const result = validateBookingForm({ name, email, seats, note })
		fieldErrors = result.errors
		return result.valid
	}

	function validateField(field: BookingField) {
		touched[field] = true
		validateForm()
	}

	const calendarDays = $derived(getCalendarDays(currentMonth))
	const monthLabel = $derived(formatMonthYear(currentMonth))
	const selectedDateSlots = $derived(selectedDate ? getSlotsForDate(slots, selectedDate) : [])
	const isFormValid = $derived(validateBookingForm({ name, email, seats, note }).valid)
	const canBook = $derived(Boolean(selectedSlot) && isFormValid)
	const selectedDateAvailabilityCount = $derived(selectedDateSlots.filter((slot) => slot.available).length)
	const isCurrentCalendarMonth = $derived(
		currentMonth.getMonth() === new Date().getMonth() && currentMonth.getFullYear() === new Date().getFullYear()
	)
	const isPreviousMonthAllowed = $derived.by(() => {
		const now = new Date()
		const prev = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
		return prev.getFullYear() > now.getFullYear() ||
			(prev.getFullYear() === now.getFullYear() && prev.getMonth() >= now.getMonth())
	})
	const isNextMonthAllowed = $derived.by(() => {
		const maxMonth = new Date()
		maxMonth.setMonth(maxMonth.getMonth() + 3)
		const next = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
		return next <= maxMonth
	})
	async function loadAvailability() {
		loading = true
		error = ''

		try {
			slots = await loadAvailabilityForMonth(currentMonth)
		} catch (err) {
			error = getErrorMessage(err, 'Failed to load availability')
		} finally {
			loading = false
		}
	}

	function goToToday() {
		currentMonth = new Date()
		selectedDate = null
		selectedSlot = null
		loadAvailability()
	}

	function prevMonth() {
		if (isPreviousMonthAllowed) {
			const prev = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
			currentMonth = prev
			selectedDate = null
			selectedSlot = null
			loadAvailability()
		}
	}

	function nextMonth() {
		if (isNextMonthAllowed) {
			const next = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
			currentMonth = next
			selectedDate = null
			selectedSlot = null
			loadAvailability()
		}
	}

	function selectDate(day: CalendarDay) {
		if (!day.isCurrentMonth || isPast(day.date)) return
		const available = getAvailableCount(slots, day.date)
		if (available === 0) return

		selectedDate = day.date
		selectedSlot = null
		status = ''
	}

	function selectSlot(slot: BookingSlot) {
		if (!slot.available) return
		selectedSlot = slot
		status = ''
		setTimeout(() => formEl?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100)
	}

	async function book() {
		// Mark all fields as touched to show any errors
		touched = { name: true, email: true, seats: true, note: true }

		if (!validateForm() || !selectedSlot) return
		status = ''
		eventLink = ''
		cancelStatus = ''

		try {
			const data = await submitBooking({
				selectedSlot,
				timeZone,
				seats,
				name,
				email,
				note,
				activityName
			})
			status = 'booked'
			eventLink = data.eventLink
			cancelToken = data.cancelToken
			await loadAvailability()
		} catch (err) {
			status = getErrorMessage(err, 'Booking failed')
		}
	}

	async function cancelBooking() {
		if (!cancelToken) return
		canceling = true
		cancelStatus = ''
		try {
			await submitCancel(cancelToken)
			cancelStatus = 'Booking canceled.'
			status = ''
			eventLink = ''
			await loadAvailability()
		} catch (err) {
			cancelStatus = getErrorMessage(err, 'Cancel failed')
		} finally {
			canceling = false
		}
	}

	function requestCancel() {
		if (!cancelToken) return
		showCancelModal = true
	}

	function confirmCancel() {
		showCancelModal = false
		cancelBooking()
	}

	async function copyCancelLink() {
		if (typeof window === 'undefined' || !cancelToken) return
		try {
			await navigator.clipboard.writeText(buildCancelLink(window.location.href, cancelToken))
			cancelStatus = 'Cancel link copied.'
		} catch {
			cancelStatus = 'Copy failed. You can copy the code below.'
		}
	}

	function reset() {
		selectedDate = null
		selectedSlot = null
		name = ''
		email = ''
		seats = 1
		note = ''
		status = ''
		eventLink = ''
		cancelToken = ''
		cancelStatus = ''
		fieldErrors = {}
		touched = {}
	}

	function handleCancelKeydown(event: KeyboardEvent) {
		if (!showCancelModal) return
		if (event.key === 'Escape') {
			showCancelModal = false
		}
	}

	onMount(() => {
		if (typeof window !== 'undefined') {
			const token = readCancelTokenFromSearch(window.location.search)
			if (token) {
				cancelToken = token
			}
		}
		loadAvailability()
	})
</script>

<svelte:window on:keydown={handleCancelKeydown} />

<p class="calendar-page__timezone">{timeZone}</p>

<!-- Calendar -->
<section class="calendar-page__section">
	<div class="calendar-page__calendar-header">
		<button class="calendar-page__month-button" onclick={prevMonth} aria-label="Previous month">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<polyline points="15 18 9 12 15 6"/>
			</svg>
		</button>
		<h2 class="calendar-page__month-label">{monthLabel}</h2>
		<button class="calendar-page__month-button" onclick={nextMonth} aria-label="Next month">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<polyline points="9 18 15 12 9 6"/>
			</svg>
		</button>
		{#if !isCurrentCalendarMonth}
			<button class="calendar-page__today-button" onclick={goToToday}>Today</button>
		{/if}
	</div>

	{#if loading}
		<p class="calendar-page__status-text--muted calendar-page__status-text--center">Loading availability…</p>
	{:else if error}
		<p class="calendar-page__status-text--error calendar-page__status-text--center">{error}</p>
		<button class="calendar-page__ghost-action calendar-page__center-button" onclick={loadAvailability}>Try again</button>
	{:else}
		<div class="calendar-page__calendar">
			<div class="calendar-page__weekdays">
				{#each weekDays as day}
					<span>{day}</span>
				{/each}
			</div>
			<div class="calendar-page__grid">
				{#each calendarDays as day}
					{@const available = getAvailableCount(slots, day.date)}
					{@const isSelected = selectedDate && isSameDay(day.date, selectedDate)}
					{@const past = isPast(day.date)}
					<button
						class="calendar-page__day"
						class:calendar-page__day--other-month={!day.isCurrentMonth}
						class:calendar-page__day--today={isToday(day.date)}
						class:calendar-page__day--selected={isSelected}
						class:calendar-page__day--has-slots={available > 0}
						class:calendar-page__day--past={past}
						disabled={!day.isCurrentMonth || past || available === 0}
						onclick={() => selectDate(day)}
					>
						<span class="calendar-page__day-number">{day.date.getDate()}</span>
						{#if day.isCurrentMonth && !past && available > 0}
							<span class="calendar-page__day-dots">
									{#each Array.from({ length: Math.min(available, 3) }, (_, i) => i) as dotIndex (dotIndex)}
										<span class="calendar-page__day-dot" style={`--dot-index: ${dotIndex}`}></span>
									{/each}
								</span>
							{/if}
					</button>
				{/each}
			</div>
		</div>

		<!-- Time Slots -->
		{#if selectedDate}
			<div class="calendar-page__slots-section">
				<div class="calendar-page__slots-header">
					<h3>{formatFullDay(selectedDate)}</h3>
					<span class="calendar-page__slots-count">{selectedDateAvailabilityCount} available</span>
				</div>
				<div class="calendar-page__slots-grid">
					{#each selectedDateSlots as slot}
						{@const isSelected = selectedSlot?.start === slot.start}
						<button
							class="calendar-page__slot-button"
							class:calendar-page__slot-button--active={isSelected}
							class:calendar-page__slot-button--full={!slot.available}
							disabled={!slot.available}
							onclick={() => selectSlot(slot)}
						>
							<span class="calendar-page__slot-time">{formatTime(slot.start)}</span>
							{#if slot.available}
								<span class="calendar-page__slot-availability">{slot.remaining} spots</span>
							{:else}
								<span class="calendar-page__slot-full">Full</span>
							{/if}
							{#if isSelected}
								<svg class="calendar-page__check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
									<polyline points="20 6 9 17 4 12"/>
								</svg>
							{/if}
						</button>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</section>

<!-- Booking Form -->
{#if selectedSlot && status !== 'booked'}
	<section class="calendar-page__section" bind:this={formEl}>
		<div class="calendar-page__form-card">
			<div class="calendar-page__form-glow {glowClass}"></div>
			<h2>Reserve your time</h2>
			<p class="calendar-page__form-subtitle">A few details and you're in.</p>

			<div class="calendar-page__selected-badge">
				<svg viewBox="0 0 24 24" fill="none" stroke="url(#sparkle-grad)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
					<defs><linearGradient id="sparkle-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#a78bfa"/><stop offset="100%" stop-color="#60a5fa"/></linearGradient></defs>
					<path d="M12 2 L14 9 L21 9 L15 14 L17 21 L12 17 L7 21 L9 14 L3 9 L10 9 Z"/>
				</svg>
				{formatFullDay(selectedSlot.start)} · {formatTime(selectedSlot.start)}
			</div>

			<div class="calendar-page__form-fields">
				<label class="calendar-page__field" class:calendar-page__field--error={touched.name && fieldErrors.name}>
					<span>Name</span>
					<input
						bind:value={name}
						placeholder="Jane Appleseed"
						onblur={() => validateField('name')}
					/>
					{#if touched.name && fieldErrors.name}
						<span class="calendar-page__field-error">{fieldErrors.name}</span>
					{/if}
				</label>
				<label class="calendar-page__field" class:calendar-page__field--error={touched.email && fieldErrors.email}>
					<span>Email</span>
					<input
						bind:value={email}
						type="email"
						placeholder="jane@example.com"
						onblur={() => validateField('email')}
					/>
					{#if touched.email && fieldErrors.email}
						<span class="calendar-page__field-error">{fieldErrors.email}</span>
					{/if}
				</label>
				<label class="calendar-page__field" class:calendar-page__field--error={touched.seats && fieldErrors.seats}>
					<span>Seats</span>
					<input
						bind:value={seats}
						type="number"
						min="1"
						max="4"
						class="calendar-page__seats-input"
						onblur={() => validateField('seats')}
					/>
					{#if touched.seats && fieldErrors.seats}
						<span class="calendar-page__field-error">{fieldErrors.seats}</span>
					{/if}
				</label>
				<label class="calendar-page__field" class:calendar-page__field--error={touched.note && fieldErrors.note}>
					<span>Note (optional)</span>
					<textarea
						bind:value={note}
						rows="3"
						placeholder="Anything we should know?"
						onblur={() => validateField('note')}
					></textarea>
					{#if touched.note && fieldErrors.note}
						<span class="calendar-page__field-error">{fieldErrors.note}</span>
					{/if}
				</label>
			</div>

			<button class="calendar-page__primary-button" class:calendar-page__primary-button--enabled={canBook} disabled={!canBook} onclick={book}>
				Confirm booking
			</button>

			<p class="calendar-page__legal-note">
				By booking, you agree to our
				<a href="/privacy">Privacy Policy</a>,
				<a href="/terms">Terms of Use</a>, and
				<a href="/cookies">Cookie Policy</a>.
			</p>

			{#if status && status !== 'booked'}
				<p class="calendar-page__form-error">{status}</p>
			{/if}
		</div>
	</section>
{/if}

<!-- Success -->
{#if status === 'booked' && selectedSlot}
	<section class="calendar-page__section">
		<div class="calendar-page__form-card calendar-page__success-card">
			<div class="calendar-page__success-icon">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
					<polyline points="20 6 9 17 4 12"/>
				</svg>
			</div>
			<h2>You're all set.</h2>
			<p class="calendar-page__success-time">{formatFullDay(selectedSlot.start)} at {formatTime(selectedSlot.start)}</p>
			<p class="calendar-page__success-email">A confirmation is on its way to {email}.</p>
			{#if eventLink}
				<p class="calendar-page__success-link"><a href={eventLink} target="_blank" rel="noreferrer">View in Google Calendar</a></p>
			{/if}
			{#if cancelToken}
				<div class="calendar-page__cancel-box">
					<p class="calendar-page__cancel-title">Need to cancel later?</p>
					<p class="calendar-page__cancel-subtitle">Save this cancel code or copy your private cancel link. If you don't get the calendar email, use the link below.</p>
					<div class="calendar-page__cancel-code">{cancelToken}</div>
					<div class="calendar-page__cancel-actions">
						<button class="calendar-page__ghost-action" onclick={copyCancelLink}>Copy cancel link</button>
						<button class="calendar-page__ghost-action calendar-page__ghost-action--danger" onclick={requestCancel} disabled={canceling}>
							{canceling ? 'Canceling…' : 'Cancel this booking'}
						</button>
					</div>
					{#if cancelStatus}
						<p class="calendar-page__cancel-status">{cancelStatus}</p>
					{/if}
				</div>
			{/if}
			<button class="calendar-page__primary-button calendar-page__primary-button--enabled" onclick={reset}>Book another</button>
		</div>
	</section>
{/if}

<!-- Cancel by code -->
<section class="calendar-page__section">
	<div class="calendar-page__form-card calendar-page__cancel-card">
		<h2>Cancel a booking</h2>
		<p class="calendar-page__form-subtitle">Paste your cancel code if you need to cancel a reservation.</p>
		<div class="calendar-page__cancel-inputs">
			<input
				class="calendar-page__cancel-input"
				placeholder="Cancel code"
				bind:value={cancelToken}
			/>
			<button class="calendar-page__ghost-action calendar-page__ghost-action--danger" onclick={requestCancel} disabled={!cancelToken || canceling}>
				{canceling ? 'Canceling…' : 'Cancel booking'}
			</button>
		</div>
		{#if cancelStatus}
			<p class="calendar-page__cancel-status">{cancelStatus}</p>
		{/if}
	</div>
</section>

{#if showCancelModal}
  <div
    class="calendar-page__modal-overlay"
    role="button"
    tabindex="0"
    aria-label="Close dialog"
    onclick={(event) => {
      if (event.target !== event.currentTarget) return
      showCancelModal = false
    }}
    onkeydown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        showCancelModal = false
      }
    }}
  >
    <div class="calendar-page__modal-card" role="dialog" aria-modal="true">
			<h3 class="calendar-page__modal-title">Cancel booking?</h3>
			<p class="calendar-page__modal-subtitle">This will free up your spot immediately.</p>
			<div class="calendar-page__modal-actions">
				<button class="calendar-page__ghost-action" onclick={() => showCancelModal = false}>Keep booking</button>
				<button class="calendar-page__ghost-action calendar-page__ghost-action--danger" onclick={confirmCancel} disabled={canceling}>
					{canceling ? 'Canceling…' : 'Yes, cancel'}
				</button>
			</div>
		</div>
	</div>
{/if}
