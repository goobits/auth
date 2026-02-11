<script>
	import { CALENDAR_ACTIVITY_LIST } from '$lib/booking/activities'
	const { data } = $props()

	const firstName = $derived(data.user?.name?.split(' ')[0] || '')
</script>

<svelte:head>
	<title>Rainbow Gym | MIKO.ART</title>
</svelte:head>

<div class="calendar-page">
	<section class="hero">
		<div class="glow"></div>
		<p class="eyebrow">Members</p>
		<h1>Hey{firstName ? `, ${firstName}` : ''}.<br/>What's the move?</h1>
		<p class="sub">Pick an activity and let's make something happen.</p>
	</section>

	<section class="section">
		<div class="activity-grid">
			{#each CALENDAR_ACTIVITY_LIST as activity}
				<a href={activity.href} class="activity-card">
					<span class="activity-icon">{activity.icon}</span>
					<h2>{activity.label}</h2>
					<p>{activity.description}</p>
				</a>
			{/each}
		</div>
	</section>
</div>
