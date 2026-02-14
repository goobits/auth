<script lang="ts">
	import type { Snippet } from 'svelte'
	import ResultsEmpty from '$lib/ui/ResultsEmpty.svelte'

	type FilterableCollectionProps = {
		count: number
		countLabel: string
		emptyMessage: string
		onClear: () => void
		className?: string
		toolbar?: Snippet
		children?: Snippet
	}

	const {
		count,
		countLabel,
		emptyMessage,
		onClear,
		className = '',
		toolbar,
		children
	}: FilterableCollectionProps = $props()
</script>

<section class={`ui-filterable ${className}`.trim()}>
	{@render toolbar?.()}

	{#if count === 0}
		<ResultsEmpty message={emptyMessage} onAction={onClear} />
	{:else}
		<p class="ui-search__results-count">{count} {countLabel}</p>
		{@render children?.()}
	{/if}
</section>
