<script>
	import { page } from '$app/stores'
	import { goto } from '$app/navigation'
	import { Bell, UserRound } from '@lucide/svelte'
	import { logoutCalendarSession } from '$lib/client/api/calendarClient'
	import { buildCalendarLoginRedirect, shouldRedirectCalendarGuest } from '$lib/client/routing/auth'
	import ShellNav from '$lib/ui/ShellNav.svelte'
	import './Calendar.scss'

	const { data, children } = $props()
	const headerLinks = $derived([...(data.activities ?? [])].sort((a, b) => a.label.localeCompare(b.label)))

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
					<a href="/calendar?mine=1" class="shell-nav__button shell-nav__button--link" aria-label="My schedule">
						<Bell size={13} />
						My schedule
					</a>
					<a href="/calendar/profile" class="shell-nav__button shell-nav__button--link" aria-label="Profile">
						<UserRound size={13} />
						Profile
					</a>
					{#if data.user.avatarUrl}
						<img src={data.user.avatarUrl} alt="" class="shell-nav__avatar" />
					{/if}
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
