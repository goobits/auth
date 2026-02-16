<script lang="ts">
	import type { Snippet } from 'svelte'
	import Hero from '$lib/ui/Hero.svelte'
	import PageShell from '$lib/ui/PageShell.svelte'
	import Prose from '$lib/ui/Prose.svelte'

	type LegalPageProps = {
		title: string
		subtitle: string
		icon?: string
		updatedAt: string
		className?: string
		showNotice?: boolean
		children?: Snippet
	}

	const {
		title,
		subtitle,
		icon = '',
		updatedAt,
		className = '',
		showNotice = false,
		children
	}: LegalPageProps = $props()
</script>

<PageShell className={`legal__shell ${className}`.trim()}>
	<div class="legal__hero-shell" style="min-height: clamp(14rem, 26vw, 21.75rem);">
		<Hero eyebrow="Legal" title={title} subtitle={subtitle} icon={icon} />
	</div>

	<Prose className="legal__page legal">
		<p class="legal__updated">Last updated {updatedAt}</p>
		{@render children?.()}
		{#if showNotice}
			<p class="legal__notice">This page is informational and is not legal advice.</p>
		{/if}
	</Prose>
</PageShell>

<style>
	.legal__hero-shell {
		width: 100%;
	}
</style>
