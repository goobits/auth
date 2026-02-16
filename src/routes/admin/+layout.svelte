<script>
	import './Admin.scss'
	import ShellNav from '$lib/ui/ShellNav.svelte'
	import PillButton from '$lib/ui/buttons/PillButton.svelte'
	import { enhance } from '$app/forms'
	import { page } from '$app/stores'
	import { goto } from '$app/navigation'

	const { children, data } = $props()
	const connectedNow = $derived($page.url.searchParams.get('connected') === '1')

	$effect(() => {
		if (!connectedNow) return
		// Clean up the query param after showing the notice (replaceState avoids history noise).
		goto('/admin/overview', { replaceState: true, keepFocus: true, noScroll: true })
	})
</script>

<div class="admin-root">
	<ShellNav currentPath={$page.url.pathname}>
		{#snippet right()}
			<span class="admin-shell__nav-badge">Admin</span>
			{#if data.user}
				<form method="POST" action="/admin?/logout" use:enhance>
					<PillButton className="admin-shell__nav-button" type="submit" size="sm" variant="secondary">
						Logout
					</PillButton>
				</form>
			{/if}
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
