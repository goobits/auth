<script>
	import './Admin.scss'
	import ShellNav from '$lib/ui/ShellNav.svelte'
	import { page } from '$app/stores'
	import { goto } from '$app/navigation'

	const { children } = $props()
	const connectedNow = $derived($page.url.searchParams.get('connected') === '1')

	$effect(() => {
		if (!connectedNow) return
		// Clean up the query param after showing the notice (replaceState avoids history noise).
		goto('/admin', { replaceState: true, keepFocus: true, noScroll: true })
	})
</script>

<div class="admin-root">
	<ShellNav brandLabel="Rainbow Gym" brandHref="/admin" currentPath={$page.url.pathname}>
		{#snippet right()}
			<span class="shell-nav__badge">Admin</span>
		{/snippet}
	</ShellNav>

	<div class="admin-shell__main">
		{#if connectedNow}
			<p class="admin-shell__notice admin-shell__notice--success">Google Calendar connected.</p>
		{/if}
		<div class="admin-shell__content">
			{@render children()}
		</div>
	</div>
</div>
