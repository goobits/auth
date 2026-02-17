<script>
	import { page } from '$app/stores'
	import { goto } from '$app/navigation'
	import { Bell, UserRound } from '@lucide/svelte'
	import { logoutCalendarSession } from '$lib/client/api/calendarClient'
	import { buildCalendarLoginRedirect, shouldRedirectCalendarGuest } from '$lib/client/routing/auth'
	import PillButton from '$lib/ui/buttons/PillButton.svelte'
	import ShellNav from '$lib/ui/ShellNav.svelte'
	import '@routes/calendar/Calendar.scss'

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
			<div class="calendar-shell__nav-user">
				{#if data.user}
					<PillButton
						href="/calendar?mine=1"
						variant="secondary"
						size="sm"
						className="calendar-shell__nav-button calendar-shell__nav-button--link"
						ariaLabel="My schedule"
					>
						<Bell size={13} />
						My schedule
					</PillButton>
					<PillButton
						href="/calendar/profile"
						variant="secondary"
						size="sm"
						className="calendar-shell__nav-button calendar-shell__nav-button--link"
						ariaLabel="Profile"
					>
						<UserRound size={13} />
						Profile
					</PillButton>
					{#if data.user.avatarUrl}
						<img src={data.user.avatarUrl} alt="" class="calendar-shell__nav-avatar" />
					{/if}
					<PillButton onClick={logout} variant="secondary" size="sm" className="calendar-shell__nav-button">
						Logout
					</PillButton>
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
