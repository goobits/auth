<script>
	import { page } from '$app/stores'
	import { goto } from '$app/navigation'
	import { CALENDAR_ACTIVITY_LIST } from '$lib/booking/activities'
	import { logoutCalendarSession } from '$lib/client/api/calendarClient'
	import { buildCalendarLoginRedirect, shouldRedirectCalendarGuest } from '$lib/client/routing/auth'
	import './Calendar.scss'

	const { data, children } = $props()

	$effect(() => {
		const pathname = $page.url.pathname
		if (shouldRedirectCalendarGuest(data.user, pathname)) {
			goto(buildCalendarLoginRedirect(pathname))
		}
	})

	function isActive(href, exact = false) {
		if (exact) return $page.url.pathname === href || $page.url.pathname === href + '/'
		return $page.url.pathname.startsWith(href)
	}

	async function logout() {
		await logoutCalendarSession()
		goto('/calendar/login')
	}
</script>

<div class="calendar-shell">
	<nav class="calendar-shell__nav">
		<div class="calendar-shell__nav-inner">
			<a href="/calendar" class="calendar-shell__brand">Members</a>
			<div class="calendar-shell__links">
				{#each CALENDAR_ACTIVITY_LIST as item}
					<a href={item.href} class:active={isActive(item.href)}>
						{item.label}
					</a>
				{/each}
			</div>
			<div class="calendar-shell__user">
				{#if data.user}
					{#if data.user.avatarUrl}
						<img src={data.user.avatarUrl} alt="" class="calendar-shell__avatar" />
					{/if}
					<span class="calendar-shell__name">{data.user.name || data.user.email}</span>
					<button onclick={logout} class="calendar-shell__logout">Logout</button>
				{/if}
			</div>
		</div>
	</nav>

	<div class="calendar-shell__layout">
		<main class="calendar-shell__main">
			{@render children()}
		</main>
	</div>
</div>

<style lang="scss">
	:global(header),
	:global(footer) {
		display: none !important;
	}

	:global(main) {
		max-width: none;
		width: 100%;
		margin: 0;
		padding: 0;
		display: contents;
	}

	.calendar-shell__layout {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	.calendar-shell__nav {
		background: var(--color-white-015);
		border-bottom: var(--border-width) solid var(--color-white-05);
		width: 100%;
		position: sticky;
		top: 0;
		z-index: 80;
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
	}

	.calendar-shell__nav-inner {
		max-width: var(--max-width, 1060px);
		margin: 0 auto;
		width: var(--calendar-nav-inner-width);
		height: var(--calendar-nav-height);
		display: flex;
		align-items: center;
		gap: var(--calendar-nav-inner-gap);
	}

	.calendar-shell__brand {
		display: inline-flex;
		align-items: center;
		font-size: 15px;
		font-weight: var(--font-weight-semibold);
		letter-spacing: -0.01em;
		background: var(--gradient-rainbow);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		text-decoration: none;
	}

	.calendar-shell__links {
		display: flex;
		gap: var(--calendar-nav-link-gap);
		flex: 1;
		align-items: center;
		min-width: 0;
	}

	.calendar-shell__links a {
		display: inline-flex;
		align-items: center;
		color: color-mix(in srgb, var(--color-white) 52%, transparent);
		text-decoration: none;
		font-size: 13px;
		font-weight: var(--font-weight-medium);
		padding: var(--calendar-nav-link-padding);
		border-radius: var(--radius-pill);
		transition: all 0.16s ease;
	}

	.calendar-shell__links a:hover {
		color: color-mix(in srgb, var(--color-white) 78%, transparent);
		background: color-mix(in srgb, var(--color-white) 3.5%, transparent);
	}

	.calendar-shell__links a.active {
		color: var(--color-white);
		background: color-mix(in srgb, var(--color-white) 7.5%, transparent);
	}

	.calendar-shell__user {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	.calendar-shell__avatar {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		border: var(--border-width) solid var(--color-white-12);
	}

	.calendar-shell__name {
		color: color-mix(in srgb, var(--color-white) 60%, transparent);
		font-size: 12px;
		font-weight: var(--font-weight-medium);
	}

	.calendar-shell__logout {
		background: transparent;
		border: var(--border-width) solid var(--color-white-10);
		color: color-mix(in srgb, var(--color-white) 54%, transparent);
		padding: var(--space-1) var(--space-3);
		border-radius: var(--radius-pill);
		cursor: pointer;
		font-size: 12px;
		font-weight: var(--font-weight-medium);
		transition: all 0.2s ease;
	}

	.calendar-shell__logout:hover {
		background: var(--color-white-04);
		border-color: color-mix(in srgb, var(--color-white) 16%, transparent);
		color: var(--color-white-82);
	}

	.calendar-shell__main {
		flex: 1;
	}

	@media (max-width: 700px) {
		.calendar-shell__nav-inner {
			padding: var(--space-3) var(--space-4);
			gap: var(--space-3);
			height: auto;
			min-height: 48px;
			flex-wrap: wrap;
		}

		.calendar-shell__links {
			order: 3;
			width: 100%;
			overflow-x: auto;
			padding-bottom: var(--space-1);
			gap: var(--space-1);
		}

		.calendar-shell__links a {
			font-size: 12px;
			padding: var(--space-1) var(--space-2);
			white-space: nowrap;
		}

		.calendar-shell__name {
			display: none;
		}
	}
</style>
