<script>
	const { data } = $props()

	const activities = [
		{
			href: '/calendar/gym',
			title: 'Gym',
			description: 'Book sessions and work out together',
			icon: '💪'
		},
		{
			href: '/calendar/circus',
			title: 'Circus',
			description: 'Aerial arts and circus skills',
			icon: '🎪'
		},
		{
			href: '/calendar/adventure',
			title: 'Adventure',
			description: 'Outdoor excursions and trips',
			icon: '🏔️'
		},
		{
			href: '/calendar/movie-night',
			title: 'Movies',
			description: 'Community film screenings',
			icon: '🎬'
		}
	]

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
			{#each activities as activity}
				<a href={activity.href} class="activity-card">
					<span class="activity-icon">{activity.icon}</span>
					<h2>{activity.title}</h2>
					<p>{activity.description}</p>
				</a>
			{/each}
		</div>
	</section>
</div>
