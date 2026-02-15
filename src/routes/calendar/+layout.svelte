<script>
	import { page } from '$app/stores'
	import { goto } from '$app/navigation'
	import { CALENDAR_ACTIVITY_LIST } from '$lib/booking/activities'
	import { logoutCalendarSession } from '$lib/client/api/calendarClient'
	import { buildCalendarLoginRedirect, shouldRedirectCalendarGuest } from '$lib/client/routing/auth'
	import ShellNav from '$lib/ui/ShellNav.svelte'
	import './Calendar.scss'

	const { data, children } = $props()
	const headerLinks = [...CALENDAR_ACTIVITY_LIST].sort((a, b) => a.label.localeCompare(b.label))

	$effect(() => {
		const pathname = $page.url.pathname
		if (shouldRedirectCalendarGuest(data.user, pathname)) {
			goto(buildCalendarLoginRedirect(pathname))
		}
	})

	async function logout() {
		await logoutCalendarSession()
		goto('/calendar/login')
	}
</script>

<div class="calendar-shell">
	<ShellNav
		brandLabel="Members"
		brandHref="/calendar"
	links={headerLinks}
	currentPath={$page.url.pathname}
	>
		{#snippet right()}
			<div class="shell-nav__user">
				{#if data.user}
					{#if data.user.avatarUrl}
						<img src={data.user.avatarUrl} alt="" class="shell-nav__avatar" />
					{/if}
					<span class="shell-nav__name">{data.user.name || data.user.email}</span>
					<button onclick={logout} class="shell-nav__button">Logout</button>
				{/if}
			</div>
		{/snippet}
	</ShellNav>

	<div class="calendar-shell__layout">
		<main class="calendar-shell__main">
			{@render children()}
		</main>
	</div>
</div>
