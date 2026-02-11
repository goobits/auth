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
		width: 64px;
		height: 64px;
		vertical-align: top;
		margin-left: 0.35rem;
	}

	@media (max-width: 700px) {
		.hero-icon {
			width: 58px;
			height: 58px;
		}
	}
</style>
