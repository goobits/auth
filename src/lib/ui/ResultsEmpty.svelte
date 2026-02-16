<script lang="ts">
	import Button from '$lib/ui/buttons/Button.svelte'

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
		<Button className="ui-search__empty-action" variant="primary" size="md" onClick={onAction}>
			{actionLabel}
		</Button>
	{/if}
</div>
