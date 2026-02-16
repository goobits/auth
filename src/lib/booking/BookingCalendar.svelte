<script lang="ts">
	import { joinCalendarEvent, leaveCalendarEvent, type CalendarEventsResponse } from '$lib/client/api/calendarClient'
	import PillButton from '$lib/ui/buttons/PillButton.svelte'

	let {
		activitySlug,
		initialUpcoming = [],
		initialRecent = []
	} = $props<{
		activitySlug: string
		initialUpcoming?: CalendarEventsResponse['upcoming']
		initialRecent?: CalendarEventsResponse['recent']
	}>()

	let upcoming = $state<CalendarEventsResponse['upcoming']>([])
	let recent = $state<CalendarEventsResponse['recent']>([])
	let pendingEventId = $state<number | null>(null)
	let actionError = $state('')

	$effect(() => {
		upcoming = initialUpcoming
		recent = initialRecent
	})

	function formatWhen(startIso: string, endIso: string) {
		const start = new Date(startIso)
		const end = new Date(endIso)
		const day = start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
		const from = start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
		const to = end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
		return `${day} · ${from}-${to}`
	}

	async function join(eventId: number, guestCount = 0) {
		pendingEventId = eventId
		actionError = ''
		try {
			const result = await joinCalendarEvent(eventId, { guestCount })
			upcoming = upcoming.map((event) => {
				if (event.id !== eventId) return event
				const nextStatus = result.status
				const wasJoined = event.userStatus === 'joined'
				const previousSeats = wasJoined ? 1 + (event.userGuestCount ?? 0) : 0
				const nextSeats = nextStatus === 'joined' ? 1 + guestCount : 0
				const seatsTakenDelta = nextSeats - previousSeats
				const seatsTaken = event.seatsTaken + seatsTakenDelta
				return {
					...event,
					userStatus: nextStatus,
					userGuestCount: guestCount,
					seatsTaken,
					seatsLeft: Math.max(0, event.capacity - seatsTaken),
					waitlistCount: nextStatus === 'waitlist' && event.userStatus !== 'waitlist'
						? event.waitlistCount + 1
						: event.waitlistCount
				}
			})
		} catch (error) {
			actionError = error instanceof Error ? error.message : 'Unable to join event'
		} finally {
			pendingEventId = null
		}
	}

	async function leave(eventId: number) {
		pendingEventId = eventId
		actionError = ''
		try {
			await leaveCalendarEvent(eventId)
			upcoming = upcoming.map((event) => {
				if (event.id !== eventId) return event
				const wasJoined = event.userStatus === 'joined'
				const wasWaitlist = event.userStatus === 'waitlist'
				const seatsToRelease = wasJoined ? 1 + (event.userGuestCount ?? 0) : 0
				return {
					...event,
					userStatus: null,
					userGuestCount: 0,
					seatsTaken: wasJoined ? Math.max(0, event.seatsTaken - seatsToRelease) : event.seatsTaken,
					seatsLeft: wasJoined ? Math.min(event.capacity, event.seatsLeft + seatsToRelease) : event.seatsLeft,
					waitlistCount: wasWaitlist ? Math.max(0, event.waitlistCount - 1) : event.waitlistCount
				}
			})
		} catch (error) {
			actionError = error instanceof Error ? error.message : 'Unable to leave event'
		} finally {
			pendingEventId = null
		}
	}
</script>

<section class="calendar-page__section calendar-home__section">
	<div class="calendar-home__feed-head">
		<h2 class="calendar-home__feed-title">Upcoming {activitySlug} events</h2>
	</div>
	{#if actionError}
		<p class="calendar-page__status-text--error">{actionError}</p>
	{/if}
	{#if upcoming.length === 0}
		<p class="calendar-page__subtitle calendar-home__sub">No upcoming sessions yet for this program.</p>
	{:else}
		<div class="calendar-home__feed-list">
			{#each upcoming as event}
				<article class="calendar-home__event-card">
					<div class="calendar-home__event-meta">
						<p class="calendar-home__event-label">{event.activityLabel}</p>
						<h3>{event.title}</h3>
						<p>{formatWhen(event.startsAt, event.endsAt)}</p>
						<p>{event.seatsTaken}/{event.capacity} seats · {event.seatsLeft} left{event.waitlistCount > 0 ? ` · waitlist ${event.waitlistCount}` : ''}</p>
						{#if event.costCents > 0}
							<p class="calendar-home__event-cost">
								${(event.costCents / 100).toFixed(2)} {event.currency}
								{#if event.payUrl}
									· <a href={event.payUrl} target="_blank" rel="noopener noreferrer">Pay now</a>
								{/if}
							</p>
						{/if}
					</div>
					<div class="calendar-home__event-side">
						<div class="calendar-home__facepile">
							{#each event.participants as participant}
								{#if participant.avatarUrl}
									<img src={participant.avatarUrl} alt={participant.name || ''} />
								{:else}
									<span>{(participant.name || '?').slice(0, 1).toUpperCase()}</span>
								{/if}
							{/each}
						</div>
						{#if event.userStatus}
							<PillButton
								className="calendar-page__ghost-button"
								variant="ghost"
								size="md"
								onClick={() => leave(event.id)}
								disabled={pendingEventId === event.id}
							>
								{pendingEventId === event.id ? '...' : 'Leave'}
							</PillButton>
						{:else}
							<PillButton
								className="calendar-page__primary-button"
								variant="primary"
								size="lg"
								onClick={() => join(event.id, 0)}
								disabled={pendingEventId === event.id}
							>
								{pendingEventId === event.id ? '...' : event.seatsLeft > 0 ? 'Join' : 'Join waitlist'}
							</PillButton>
							{#if event.seatsLeft >= 2}
								<PillButton
									className="calendar-page__ghost-button"
									variant="ghost"
									size="md"
									onClick={() => join(event.id, 1)}
									disabled={pendingEventId === event.id}
								>
									{pendingEventId === event.id ? '...' : 'Join +1'}
								</PillButton>
							{/if}
						{/if}
					</div>
				</article>
			{/each}
		</div>
	{/if}
</section>

<section class="calendar-page__section calendar-home__section">
	<h2 class="calendar-home__feed-title">Recent memories</h2>
	{#if recent.length === 0}
		<p class="calendar-page__subtitle calendar-home__sub">No completed sessions yet.</p>
	{:else}
		<div class="calendar-home__feed-list">
			{#each recent as event}
				<article class="calendar-home__event-card calendar-home__event-card--memory">
					{#if event.heroImageUrl}
						<img src={event.heroImageUrl} alt="" class="calendar-home__memory-image" />
					{/if}
					<div class="calendar-home__event-meta">
						<p class="calendar-home__event-label">{event.activityLabel}</p>
						<h3>{event.title}</h3>
						<p>{formatWhen(event.startsAt, event.endsAt)}</p>
						<p>{event.seatsTaken}/{event.capacity} joined</p>
						{#if event.recapText}
							<p class="calendar-home__memory-recap">{event.recapText}</p>
						{/if}
					</div>
				</article>
			{/each}
		</div>
	{/if}
</section>
