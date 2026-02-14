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

<div class="metadata-values">
    {#each values as value}
        <a href={`/journal/${type}/${slugifyValue(value)}`}>
            <span class="metadata-values__value">{formatValue(value)}</span>
        </a>
    {/each}
</div>

<style lang="scss">
	.metadata-values {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.25rem;

		.metadata-values__value {
			background: var(--tag-bg);
			border-radius: 3px;
			color: var(--muted);
			display: inline-block;
			font-size: 0.875rem;
			margin: 0;
			padding: 0.2rem 0.6rem;
			text-decoration: none;

			&:hover {
				background: var(--tag-hover-bg);
			}
		}
	}
</style>
