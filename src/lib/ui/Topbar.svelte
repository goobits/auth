<script lang="ts">
	import type { NavItem } from '$lib/layout/nav'
	import ThemeSelect from '$lib/ui/ThemeSelect.svelte'

	type TopbarProps = {
		items: NavItem[]
		activePath: string
	}

	const { items, activePath }: TopbarProps = $props()
</script>

{#each items as item}
	<a href={item.href} class:active={activePath === item.href}>{item.label}</a>
{/each}
<theme-toggle>
	<ThemeSelect />
</theme-toggle>
