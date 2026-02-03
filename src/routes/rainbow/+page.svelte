<script>
	const { data } = $props()

	const activities = [
		{
			href: '/rainbow/gym',
			title: 'Gym',
			description: 'Book gym sessions and track your fitness journey',
			icon: '💪'
		},
		{
			href: '/rainbow/circus',
			title: 'Circus',
			description: 'Aerial arts, acrobatics, and circus skills training',
			icon: '🎪'
		},
		{
			href: '/rainbow/adventure',
			title: 'Adventure',
			description: 'Outdoor adventures and excursions',
			icon: '🏔️'
		},
		{
			href: '/rainbow/movie-night',
			title: 'Movie Night',
			description: 'Community movie nights and film screenings',
			icon: '🎬'
		}
	]
</script>

<div class="dashboard">
	<h1>Welcome{data.user?.name ? `, ${data.user.name}` : ''}!</h1>
	<p class="subtitle">Choose an activity to get started</p>

	<div class="activity-grid">
		{#each activities as activity}
			<a href={activity.href} class="activity-card">
				<span class="activity-icon">{activity.icon}</span>
				<h2>{activity.title}</h2>
				<p>{activity.description}</p>
			</a>
		{/each}
	</div>
</div>

<style>
	.dashboard {
		text-align: center;
	}

	h1 {
		font-size: 2.5rem;
		margin-bottom: 0.5rem;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.subtitle {
		color: var(--text-secondary, #666);
		font-size: 1.1rem;
		margin-bottom: 2rem;
	}

	.activity-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 1.5rem;
		max-width: 900px;
		margin: 0 auto;
	}

	.activity-card {
		background: var(--card-bg, white);
		border: 1px solid var(--border, #e0e0e0);
		border-radius: 12px;
		padding: 2rem;
		text-decoration: none;
		color: inherit;
		transition: all 0.2s;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
	}

	.activity-card:hover {
		transform: translateY(-4px);
		box-shadow: 0 8px 24px rgba(102, 126, 234, 0.15);
		border-color: #667eea;
	}

	.activity-icon {
		font-size: 3rem;
		margin-bottom: 1rem;
	}

	.activity-card h2 {
		font-size: 1.25rem;
		margin-bottom: 0.5rem;
		color: var(--text-primary, #333);
	}

	.activity-card p {
		color: var(--text-secondary, #666);
		font-size: 0.9rem;
		margin: 0;
	}
</style>
