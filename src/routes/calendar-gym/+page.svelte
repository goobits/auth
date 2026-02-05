<script>
	import { onMount } from 'svelte'
	import { z } from 'zod'
	import './CalendarGym.scss'

	const bookingSchema = z.object({
		name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name is too long'),
		email: z.string().email('Please enter a valid email'),
		seats: z.number().int().min(1, 'At least 1 seat required').max(4, 'Maximum 4 seats'),
		note: z.string().max(500, 'Note is too long').optional()
	})

	let slots = $state([])
	let loading = $state(true)
	let error = $state('')
	let currentMonth = $state(new Date())
	let selectedDate = $state(null)
	let selectedSlot = $state(null)
	let name = $state('')
	let email = $state('')
	let seats = $state(1)
	let note = $state('')
	let status = $state('')
	let eventLink = $state('')
	let formEl = $state(null)
	let fieldErrors = $state({})
	let touched = $state({})
	let cancelToken = $state('')
	let cancelStatus = $state('')
	let canceling = $state(false)
	let showCancelModal = $state(false)

	const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
	const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

	function validateForm() {
		const result = bookingSchema.safeParse({
			name: name.trim(),
			email: email.trim(),
			seats: Number(seats),
			note: note.trim() || undefined
		})

		if (!result.success) {
			const errors = {}
			for (const issue of result.error.issues) {
				const field = issue.path[0]
				if (!errors[field]) errors[field] = issue.message
			}
			fieldErrors = errors
			return false
		}

		fieldErrors = {}
		return true
	}

	function validateField(field) {
		touched[field] = true
		validateForm()
	}

	const isFormValid = $derived(() => {
		const result = bookingSchema.safeParse({
			name: name.trim(),
			email: email.trim(),
			seats: Number(seats),
			note: note.trim() || undefined
		})
		return result.success
	})

	function getMonthRange(date) {
		const start = new Date(date.getFullYear(), date.getMonth(), 1)
		const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59)
		return { start, end }
	}

	function getCalendarDays(date) {
		const { start, end } = getMonthRange(date)
		const days = []

		// Add padding for days before month starts
		const startDay = start.getDay()
		for (let i = 0; i < startDay; i++) {
			const d = new Date(start)
			d.setDate(d.getDate() - (startDay - i))
			days.push({ date: d, isCurrentMonth: false })
		}

		// Add days of the month
		for (let d = 1; d <= end.getDate(); d++) {
			days.push({
				date: new Date(date.getFullYear(), date.getMonth(), d),
				isCurrentMonth: true
			})
		}

		// Add padding for days after month ends
		const endDay = end.getDay()
		for (let i = 1; i < 7 - endDay; i++) {
			const d = new Date(end)
			d.setDate(d.getDate() + i)
			days.push({ date: d, isCurrentMonth: false })
		}

		return days
	}

	function formatMonthYear(date) {
		return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
	}

	function formatFullDay(iso) {
		return new Date(iso).toLocaleDateString(undefined, {
			weekday: 'long',
			month: 'long',
			day: 'numeric'
		})
	}

	function formatTime(iso) {
		return new Date(iso).toLocaleTimeString(undefined, {
			hour: 'numeric',
			minute: '2-digit'
		})
	}

	function isSameDay(d1, d2) {
		return d1.toDateString() === d2.toDateString()
	}

	function isToday(date) {
		return isSameDay(date, new Date())
	}

	function isPast(date) {
		const today = new Date()
		today.setHours(0, 0, 0, 0)
		return date < today
	}

	function getSlotsForDate(date) {
		return slots.filter(slot => isSameDay(new Date(slot.start), date))
	}

	function getAvailableCount(date) {
		return getSlotsForDate(date).filter(s => s.available).length
	}

	const calendarDays = $derived(getCalendarDays(currentMonth))
	const monthLabel = $derived(formatMonthYear(currentMonth))
	const selectedDateSlots = $derived(selectedDate ? getSlotsForDate(selectedDate) : [])
	const canBook = $derived(selectedSlot && isFormValid())

	async function loadAvailability() {
		loading = true
		error = ''

		try {
			const { start, end } = getMonthRange(currentMonth)

			const res = await fetch(`/api/calendar/availability?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`)
			const data = await res.json()
			if (!res.ok) throw new Error(data.error?.message || 'Failed to load availability')

			slots = data.slots || []
		} catch (err) {
			error = err.message || 'Failed to load availability'
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
		const now = new Date()
		const prev = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
		// Don't go before current month
		if (prev.getFullYear() > now.getFullYear() ||
			(prev.getFullYear() === now.getFullYear() && prev.getMonth() >= now.getMonth())) {
			currentMonth = prev
			selectedDate = null
			selectedSlot = null
			loadAvailability()
		}
	}

	function nextMonth() {
		const maxMonth = new Date()
		maxMonth.setMonth(maxMonth.getMonth() + 3)
		const next = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
		if (next <= maxMonth) {
			currentMonth = next
			selectedDate = null
			selectedSlot = null
			loadAvailability()
		}
	}

	function selectDate(day) {
		if (!day.isCurrentMonth || isPast(day.date)) return
		const available = getAvailableCount(day.date)
		if (available === 0) return

		selectedDate = day.date
		selectedSlot = null
		status = ''
	}

	function selectSlot(slot) {
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
			const res = await fetch('/api/calendar/book', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					start: selectedSlot.start,
					end: selectedSlot.end,
					timezone: timeZone,
					seats,
					name,
					email,
					note,
					idempotencyKey: crypto.randomUUID()
				})
			})
			const data = await res.json()
			if (!res.ok) throw new Error(data.error?.message || 'Booking failed')

			status = 'booked'
			eventLink = data.eventLink || ''
			cancelToken = data.cancelToken || ''
			await loadAvailability()
		} catch (err) {
			status = err.message || 'Booking failed'
		}
	}

	async function cancelBooking() {
		if (!cancelToken) return
		canceling = true
		cancelStatus = ''
		try {
			const res = await fetch('/api/calendar/cancel', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ cancelToken })
			})
			const data = await res.json()
			if (!res.ok) throw new Error(data.error?.message || 'Cancel failed')
			cancelStatus = 'Booking canceled.'
			status = ''
			eventLink = ''
			await loadAvailability()
		} catch (err) {
			cancelStatus = err.message || 'Cancel failed'
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
		const url = new URL(window.location.href)
		url.searchParams.set('cancel', cancelToken)
		try {
			await navigator.clipboard.writeText(url.toString())
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

	function handleCancelKeydown(event) {
		if (!showCancelModal) return
		if (event.key === 'Escape') {
			showCancelModal = false
		}
	}

	onMount(() => {
		if (typeof window !== 'undefined') {
			const params = new URLSearchParams(window.location.search)
			const token = params.get('cancel')
			if (token) {
				cancelToken = token
			}
		}
		loadAvailability()
	})
</script>

<svelte:window on:keydown={handleCancelKeydown} />

<svelte:head>
	<title>Rainbow Gym | MIKO.ART</title>
</svelte:head>

<div class="calendar-gym">
	<!-- Hero -->
	<section class="hero">
		<div class="glow"></div>
		<p class="eyebrow">Rainbow Gym</p>
		<h1>Hang out. Work out.<br/>Whatever.</h1>
		<p class="sub">Grab a time slot and let's do something fun.</p>
		<p class="tz">{timeZone}</p>
	</section>

	<!-- Calendar -->
	<section class="section">
		<div class="calendar-header">
			<button class="month-btn" onclick={prevMonth} aria-label="Previous month">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<polyline points="15 18 9 12 15 6"/>
				</svg>
			</button>
			<h2 class="month-label">{monthLabel}</h2>
			<button class="month-btn" onclick={nextMonth} aria-label="Next month">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<polyline points="9 18 15 12 9 6"/>
				</svg>
			</button>
			{#if currentMonth.getMonth() !== new Date().getMonth() || currentMonth.getFullYear() !== new Date().getFullYear()}
				<button class="today-btn" onclick={goToToday}>Today</button>
			{/if}
		</div>

		{#if loading}
			<p class="muted center">Loading availability…</p>
		{:else if error}
			<p class="error center">{error}</p>
			<button class="ghost center-btn" onclick={loadAvailability}>Try again</button>
		{:else}
			<div class="calendar">
				<div class="calendar-weekdays">
					{#each weekDays as day}
						<span>{day}</span>
					{/each}
				</div>
				<div class="calendar-grid">
					{#each calendarDays as day}
						{@const available = getAvailableCount(day.date)}
						{@const isSelected = selectedDate && isSameDay(day.date, selectedDate)}
						{@const past = isPast(day.date)}
						<button
							class="calendar-day"
							class:other-month={!day.isCurrentMonth}
							class:today={isToday(day.date)}
							class:selected={isSelected}
							class:has-slots={available > 0}
							class:past={past}
							disabled={!day.isCurrentMonth || past || available === 0}
							onclick={() => selectDate(day)}
						>
							<span class="day-num">{day.date.getDate()}</span>
							{#if day.isCurrentMonth && !past && available > 0}
								<span class="day-dots">
									{#each Array(Math.min(available, 3)) as _}
										<span class="dot"></span>
									{/each}
								</span>
							{/if}
						</button>
					{/each}
				</div>
			</div>

			<!-- Time Slots -->
			{#if selectedDate}
				<div class="slots-section">
					<div class="slots-header">
						<h3>{formatFullDay(selectedDate)}</h3>
						<span class="slots-count">{selectedDateSlots.filter(s => s.available).length} available</span>
					</div>
					<div class="slots-grid">
						{#each selectedDateSlots as slot}
							{@const isSelected = selectedSlot?.start === slot.start}
							<button
								class="slot-btn"
								class:active={isSelected}
								class:full={!slot.available}
								disabled={!slot.available}
								onclick={() => selectSlot(slot)}
							>
								<span class="slot-time">{formatTime(slot.start)}</span>
								{#if slot.available}
									<span class="slot-avail">{slot.remaining} spots</span>
								{:else}
									<span class="slot-full">Full</span>
								{/if}
								{#if isSelected}
									<svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
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
		<section class="section" bind:this={formEl}>
			<div class="form-card">
				<div class="form-glow"></div>
				<h2>Reserve your time</h2>
				<p class="form-sub">A few details and you're in.</p>

				<div class="selected-badge">
					<svg viewBox="0 0 24 24" fill="none" stroke="url(#sparkle-grad)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
						<defs><linearGradient id="sparkle-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#a78bfa"/><stop offset="100%" stop-color="#60a5fa"/></linearGradient></defs>
						<path d="M12 2 L14 9 L21 9 L15 14 L17 21 L12 17 L7 21 L9 14 L3 9 L10 9 Z"/>
					</svg>
					{formatFullDay(selectedSlot.start)} · {formatTime(selectedSlot.start)}
				</div>

				<div class="form-fields">
					<label class:has-error={touched.name && fieldErrors.name}>
						<span>Name</span>
						<input
							bind:value={name}
							placeholder="Jane Appleseed"
							onblur={() => validateField('name')}
						/>
						{#if touched.name && fieldErrors.name}
							<span class="field-error">{fieldErrors.name}</span>
						{/if}
					</label>
					<label class:has-error={touched.email && fieldErrors.email}>
						<span>Email</span>
						<input
							bind:value={email}
							type="email"
							placeholder="jane@example.com"
							onblur={() => validateField('email')}
						/>
						{#if touched.email && fieldErrors.email}
							<span class="field-error">{fieldErrors.email}</span>
						{/if}
					</label>
					<label class:has-error={touched.seats && fieldErrors.seats}>
						<span>Seats</span>
						<input
							bind:value={seats}
							type="number"
							min="1"
							max="4"
							class="seats-input"
							onblur={() => validateField('seats')}
						/>
						{#if touched.seats && fieldErrors.seats}
							<span class="field-error">{fieldErrors.seats}</span>
						{/if}
					</label>
					<label class:has-error={touched.note && fieldErrors.note}>
						<span>Note (optional)</span>
						<textarea
							bind:value={note}
							rows="3"
							placeholder="Anything we should know?"
							onblur={() => validateField('note')}
						></textarea>
						{#if touched.note && fieldErrors.note}
							<span class="field-error">{fieldErrors.note}</span>
						{/if}
					</label>
				</div>

				<button class="primary-btn" class:enabled={canBook} disabled={!canBook} onclick={book}>
					Confirm booking
				</button>

				{#if status && status !== 'booked'}
					<p class="form-error">{status}</p>
				{/if}
			</div>
		</section>
	{/if}

	<!-- Success -->
	{#if status === 'booked'}
		<section class="section">
			<div class="form-card success-card">
				<div class="success-icon">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
						<polyline points="20 6 9 17 4 12"/>
					</svg>
				</div>
				<h2>You're all set.</h2>
				<p class="success-time">{formatFullDay(selectedSlot.start)} at {formatTime(selectedSlot.start)}</p>
				<p class="success-email">A confirmation is on its way to {email}.</p>
				{#if eventLink}
					<p class="success-link"><a href={eventLink} target="_blank" rel="noreferrer">View in Google Calendar</a></p>
				{/if}
				{#if cancelToken}
					<div class="cancel-box">
						<p class="cancel-title">Need to cancel later?</p>
						<p class="cancel-sub">Save this cancel code or copy your private cancel link. If you don’t get the calendar email, use the link below.</p>
						<div class="cancel-code">{cancelToken}</div>
						<div class="cancel-actions">
							<button class="ghost" onclick={copyCancelLink}>Copy cancel link</button>
							<button class="ghost danger" onclick={requestCancel} disabled={canceling}>
								{canceling ? 'Canceling…' : 'Cancel this booking'}
							</button>
						</div>
						{#if cancelStatus}
							<p class="cancel-status">{cancelStatus}</p>
						{/if}
					</div>
				{/if}
				<button class="primary-btn enabled" onclick={reset}>Book another</button>
			</div>
		</section>
	{/if}

	<!-- Cancel by code -->
	<section class="section">
		<div class="form-card cancel-card">
			<h2>Cancel a booking</h2>
			<p class="form-sub">Paste your cancel code if you need to cancel a reservation.</p>
			<div class="cancel-inputs">
				<input
					class="cancel-input"
					placeholder="Cancel code"
					bind:value={cancelToken}
				/>
				<button class="ghost danger" onclick={requestCancel} disabled={!cancelToken || canceling}>
					{canceling ? 'Canceling…' : 'Cancel booking'}
				</button>
			</div>
			{#if cancelStatus}
				<p class="cancel-status">{cancelStatus}</p>
			{/if}
		</div>
	</section>
	{#if showCancelModal}
		<div
			class="modal-overlay"
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
			<div class="modal-card" role="dialog" aria-modal="true">
				<h3 class="modal-title">Cancel booking?</h3>
				<p class="modal-sub">This will free up your spot immediately.</p>
				<div class="modal-actions">
					<button class="ghost" onclick={() => showCancelModal = false}>Keep booking</button>
					<button class="ghost danger" onclick={confirmCancel} disabled={canceling}>
						{canceling ? 'Canceling…' : 'Yes, cancel'}
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
