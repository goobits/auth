<script>
	const { title, subtitle = '', icon = '', iconAlt = '' } = $props()
</script>

<div class="hero">
	<h1>
		{title}
		{#if icon}
			<img src={icon} class="hero-icon" alt={iconAlt} />
		{/if}
	</h1>
	{#if subtitle}
		<h2>{subtitle}</h2>
	{/if}
</div>

<style>
	.hero h1 {
		margin-bottom: 0.2em;
	}

	.hero h2 {
		margin: 0.35em 0 0.9em;
		white-space: normal;
	}

	.hero-icon {
		width: 0.85em;
		height: 0.85em;
		vertical-align: -0.08em;
		margin-left: 0.35rem;
		object-fit: contain;
	}
</style>
