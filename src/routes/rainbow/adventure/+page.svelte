<script>
	const { data } = $props()
</script>

<div class="activity-page">
	<h1>Adventure</h1>
	<p class="description">Outdoor adventures and excursions.</p>

	<div class="content-card">
		<h2>Coming Soon</h2>
		<p>
			Adventure booking is being developed.
			You'll be able to sign up for hiking trips,
			camping excursions, and other outdoor activities.
		</p>
	</div>
</div>

<style>
	.activity-page {
		max-width: 800px;
		margin: 0 auto;
	}

	h1 {
		font-size: 2rem;
		margin-bottom: 0.5rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	h1::before {
		content: '🏔️';
	}

	.description {
		color: var(--text-secondary, #666);
		margin-bottom: 2rem;
	}

	.content-card {
		background: var(--card-bg, white);
		border: 1px solid var(--border, #e0e0e0);
		border-radius: 12px;
		padding: 2rem;
	}

	.content-card h2 {
		font-size: 1.25rem;
		margin-bottom: 1rem;
	}

	.content-card p {
		color: var(--text-secondary, #666);
	}
</style>
