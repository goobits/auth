<script lang="ts">
	type ResultsEmptyProps = {
		message: string
		actionLabel?: string
		onAction?: () => void
		className?: string
	}

	const {
		message,
		actionLabel = 'Clear Filters',
		onAction,
		className = ''
	}: ResultsEmptyProps = $props()
</script>

<div class={`ui-search__empty ${className}`.trim()}>
	<p>{message}</p>
	{#if onAction}
		<button onclick={onAction}>{actionLabel}</button>
	{/if}
</div>
