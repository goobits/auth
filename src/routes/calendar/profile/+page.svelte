<script>
	import { saveCalendarProfile } from '$lib/client/api/calendarClient'
	import PillButton from '$lib/ui/buttons/PillButton.svelte'

	let { data } = $props()
	let emergencyContact = $derived(data.profile?.emergencyContact ?? '')
	let dietaryRestrictions = $derived(data.profile?.dietaryRestrictions ?? '')
	let chatHandle = $derived(data.profile?.chatHandle ?? '')
	let saving = $state(false)
	let status = $state('')

	async function save() {
		saving = true
		status = ''
		try {
			await saveCalendarProfile({
				emergencyContact,
				dietaryRestrictions,
				chatHandle
			})
			status = 'Saved.'
		} catch (error) {
			status = error instanceof Error ? error.message : 'Failed to save profile'
		} finally {
			saving = false
		}
	}

	function formatWhen(startIso) {
		return new Date(startIso).toLocaleString(undefined, {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		})
	}
</script>

<svelte:head>
	<title>Profile | Rainbow Gym | MIKO.ART</title>
</svelte:head>

<div class="calendar-page calendar-home">
	<section class="calendar-page__hero calendar-home__hero">
		<div class="calendar-page__hero-glow calendar-home__glow"></div>
		<p class="calendar-page__eyebrow calendar-home__eyebrow">Profile</p>
		<h1>Your member profile.</h1>
		<p class="calendar-page__subtitle calendar-home__sub">Keep logistics in one place so sessions coordinate faster.</p>
	</section>

	<section class="calendar-page__section calendar-home__section">
		<div class="calendar-home__event-card">
			<div class="calendar-home__event-meta" style="width: 100%">
				<h3>Safety + logistics</h3>
				<p>Only admins can see this information.</p>
				<div class="admin-page__fields-grid" style="margin-top: 0.9rem">
					<div class="admin-page__field">
						<label class="admin-page__field-label" for="profile-emergency-contact">Emergency contact</label>
						<input id="profile-emergency-contact" class="admin-page__input" type="text" bind:value={emergencyContact} />
					</div>
					<div class="admin-page__field">
						<label class="admin-page__field-label" for="profile-dietary-restrictions">Dietary restrictions</label>
						<input id="profile-dietary-restrictions" class="admin-page__input" type="text" bind:value={dietaryRestrictions} />
					</div>
					<div class="admin-page__field">
						<label class="admin-page__field-label" for="profile-chat-handle">Discord/Chat handle</label>
						<input id="profile-chat-handle" class="admin-page__input" type="text" bind:value={chatHandle} />
					</div>
				</div>
				<div style="display:flex; gap:0.75rem; align-items:center; margin-top:0.7rem">
					<PillButton className="calendar-page__primary-button" variant="primary" size="lg" onClick={save} disabled={saving}>
						{saving ? 'Saving...' : 'Save profile'}
					</PillButton>
					<PillButton
						className="calendar-page__ghost-button"
						variant="ghost"
						size="md"
						href="/api/calendar/ics"
						target="_blank"
						rel="noopener noreferrer"
					>
						Subscribe (.ics)
					</PillButton>
					{#if status}<span class="calendar-page__status-text--muted">{status}</span>{/if}
				</div>
			</div>
		</div>
	</section>

	<section class="calendar-page__section calendar-home__section">
		<h2 class="calendar-home__feed-title">My upcoming events</h2>
		{#if data.events.length === 0}
			<p class="calendar-page__subtitle calendar-home__sub">No upcoming joins yet.</p>
		{:else}
			<div class="calendar-home__feed-list">
				{#each data.events as event}
					<article class="calendar-home__event-card">
						<div class="calendar-home__event-meta">
							<p class="calendar-home__event-label">{event.activityLabel}</p>
							<h3>{event.title}</h3>
							<p>{formatWhen(event.startsAt)}</p>
							<p>{event.userStatus === 'waitlist' ? 'Waitlist' : 'Joined'} · {event.seatsTaken}/{event.capacity} seats</p>
						</div>
					</article>
				{/each}
			</div>
		{/if}
	</section>
</div>
