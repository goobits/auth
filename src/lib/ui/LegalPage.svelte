<script lang="ts">
	import type { Snippet } from 'svelte'
	import Hero from '$lib/ui/Hero.svelte'
	import Prose from '$lib/ui/Prose.svelte'

	type LegalPageProps = {
		title: string
		subtitle: string
		icon: string
		updatedAt: string
		className?: string
		showNotice?: boolean
		children?: Snippet
	}

	const {
		title,
		subtitle,
		icon,
		updatedAt,
		className = '',
		showNotice = false,
		children
	}: LegalPageProps = $props()
</script>

<Hero title={title} subtitle={subtitle} icon={icon} />

<Prose className={`legal__page legal ${className}`.trim()}>
	<p class="legal__updated">Last updated: {updatedAt}</p>
	{@render children?.()}
	{#if showNotice}
		<p class="legal__notice">This page is informational and is not legal advice.</p>
	{/if}
</Prose>
