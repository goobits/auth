<script>
	import { joinCalendarEvent, leaveCalendarEvent } from '$lib/client/api/calendarClient'
	import { applyEventMutationState } from '$lib/booking/feed-state'
	import PillButton from '$lib/ui/buttons/PillButton.svelte'
	let { data } = $props()
	let upcoming = $state([])
	let recent = $state([])
	let pendingEventId = $state(null)
	let feedError = $state('')

	$effect(() => {
		upcoming = data.upcoming ?? []
		recent = data.recent ?? []
	})

	async function join(eventId, guestCount = 0) {
		pendingEventId = eventId
		feedError = ''
		try {
			const result = await joinCalendarEvent(eventId, { guestCount })
			upcoming = applyEventMutationState(upcoming, eventId, result.state)
		} catch (error) {
			feedError = error instanceof Error ? error.message : 'Unable to join event'
		} finally {
			pendingEventId = null
		}
	}

	async function leave(eventId) {
		pendingEventId = eventId
		feedError = ''
		try {
			const result = await leaveCalendarEvent(eventId)
			upcoming = applyEventMutationState(upcoming, eventId, result.state)
		} catch (error) {
			feedError = error instanceof Error ? error.message : 'Unable to leave event'
		} finally {
			pendingEventId = null
		}
	}

	function formatWhen(startIso, endIso) {
		const start = new Date(startIso)
		const end = new Date(endIso)
		const day = start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
		const from = start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
		const to = end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
		return `${day} · ${from}-${to}`
	}
</script>

<svelte:head>
	<title>Rainbow Gym | MIKO.ART</title>
</svelte:head>

<div class="calendar-page calendar-home">
	<section class="calendar-page__hero calendar-home__hero">
		<div class="calendar-page__hero-glow calendar-home__glow"></div>
		<p class="calendar-page__eyebrow calendar-home__eyebrow">Members</p>
		<h1>Hey{data.user?.name?.split(' ')[0] ? `, ${data.user.name.split(' ')[0]}` : ''}.<br/>What's the move?</h1>
		<p class="calendar-page__subtitle calendar-home__sub">Pick an activity and let's make something happen.</p>
	</section>

	<section class="calendar-page__section calendar-home__section">
		<div class="calendar-home__feed-head">
			<h2 class="calendar-home__feed-title">{data.onlyMine ? 'My Schedule' : 'Upcoming Events'}</h2>
			<PillButton
				href={data.onlyMine ? '/calendar' : '/calendar?mine=1'}
				variant="ghost"
				size="md"
				className="calendar-page__ghost-button"
			>
				{data.onlyMine ? 'Show all events' : 'My schedule'}
			</PillButton>
		</div>
		{#if feedError}
			<p class="calendar-page__status-text--muted">{feedError}</p>
		{/if}
		{#if upcoming.length === 0}
			<p class="calendar-page__subtitle calendar-home__sub">No events are scheduled yet.</p>
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
		<h2 class="calendar-home__feed-title">Last Week</h2>
		{#if recent.length === 0}
			<p class="calendar-page__subtitle calendar-home__sub">No completed events yet.</p>
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

	<section class="calendar-page__section calendar-home__section">
		<h2 class="calendar-home__feed-title">Browse Activities</h2>
		{#if data.activities.length === 0}
			<p class="calendar-page__subtitle calendar-home__sub">No programs are open right now. Check back soon.</p>
		{:else}
			<div class="calendar-page__activity-grid calendar-home__grid">
				{#each data.activities as activity}
					<a href={activity.href} class="calendar-page__activity-card calendar-home__card">
						<span class="calendar-page__activity-icon calendar-home__icon">{activity.icon}</span>
						<h2>{activity.label}</h2>
						<p>{activity.description}</p>
					</a>
				{/each}
			</div>
		{/if}
	</section>
</div>
