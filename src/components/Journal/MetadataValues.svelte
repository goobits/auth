<script>
	export let values = []
	export let type = 'category' // 'category' or 'tag'

	const formatValue = (value) => {
		return value.split('-')
			.map(word => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ')
	}

	const slugifyValue = (value) => {
		return value.toLowerCase().replace(/\s+/g, '-')
	}
</script>

<div class="values">
    {#each values as value}
        <a href={`/journal/${type}/${slugifyValue(value)}`}>
            <span class="value">{formatValue(value)}</span>
        </a>
    {/each}
</div>

<style lang="scss">
	.values {
		margin-top: 0.5rem;
		display: inline-block;

		.value {
			background: var(--tag-bg);
			border-radius: 3px;
			color: var(--muted);
			display: inline-block;
			font-size: 0.875rem;
			margin: 0 0.25rem;
			padding: 0.2rem 0.6rem;
			text-decoration: none;

			&:hover {
				background: var(--tag-hover-bg);
			}
		}
	}
</style>