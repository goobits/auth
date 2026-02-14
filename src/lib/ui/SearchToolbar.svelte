<script lang="ts">
	import type { Snippet } from 'svelte'
	import { Search } from '@lucide/svelte'

	type SearchToolbarProps = {
		query?: string
		placeholder?: string
		ariaLabel?: string
		className?: string
		children?: Snippet
	}

	let {
		query = $bindable(''),
		placeholder = 'Search...',
		ariaLabel = 'Search',
		className = '',
		children
	}: SearchToolbarProps = $props()
</script>

<div class={`ui-search-toolbar ${className}`.trim()}>
	<label class="ui-search__field" aria-label={ariaLabel}>
		<Search class="ui-search__icon" size={15} strokeWidth={2.2} />
		<input class="ui-search__input" type="text" placeholder={placeholder} bind:value={query} />
	</label>
	<div class="ui-search-toolbar__controls">
		{@render children?.()}
	</div>
</div>
