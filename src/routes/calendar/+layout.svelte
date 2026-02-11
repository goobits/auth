<script>
	import { page } from '$app/stores'
	import { goto } from '$app/navigation'
	import { CALENDAR_ACTIVITY_LIST } from '$lib/booking/activities'
	import './Calendar.scss'

	const { data, children } = $props()

	// Client-side auth check - redirect to login if no user (except on login page)
	$effect(() => {
		const pathname = $page.url.pathname
		const isLoginPage = pathname === '/calendar/login' || pathname === '/calendar/login/'
		if (!data.user && !isLoginPage) {
			const redirectTo = encodeURIComponent(pathname)
			goto(`/calendar/login?redirect=${redirectTo}`)
		}
	})

	function isActive(href, exact = false) {
		if (exact) return $page.url.pathname === href || $page.url.pathname === href + '/'
		return $page.url.pathname.startsWith(href)
	}

	async function logout() {
		await fetch('/auth/logout', { method: 'POST' })
		goto('/calendar/login')
	}
</script>

<div class="calendar-shell">
	<nav class="calendar-shell__nav">
		<div class="calendar-shell__nav-inner">
			<a href="/calendar" class="calendar-shell__brand">Members</a>
			<div class="calendar-shell__links">
				{#each CALENDAR_ACTIVITY_LIST as item}
					<a
						href={item.href}
						class:active={isActive(item.href)}
					>
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
	.calendar-shell {
		&__layout {
			flex: 1;
			display: flex;
			flex-direction: column;
		}

		&__nav {
			background: var(--color-white-015);
			border-bottom: 1px solid var(--color-white-05);
			width: 100%;
			position: sticky;
			top: 0;
			z-index: 80;
			backdrop-filter: blur(12px);
			-webkit-backdrop-filter: blur(12px);
		}

		&__nav-inner {
			max-width: var(--max-width, 1060px);
			margin: 0 auto;
			width: calc(100% - 2em);
			height: 50px;
			display: flex;
			align-items: center;
			gap: 20px;
		}

		&__brand {
			font-size: 15px;
			font-weight: 600;
			letter-spacing: -0.01em;
			background: linear-gradient(90deg, #ff6b6b, #feca57, #48dbfb, #ff9ff3, #a78bfa);
			-webkit-background-clip: text;
			-webkit-text-fill-color: transparent;
			background-clip: text;
			text-decoration: none;
		}

		&__links {
			display: flex;
			gap: 6px;
			flex: 1;

			a {
				color: color-mix(in srgb, var(--color-white) 52%, transparent);
				text-decoration: none;
				font-size: 13px;
				font-weight: 500;
				padding: 6px 11px;
				border-radius: 999px;
				transition: all 0.16s ease;

				&:hover {
					color: color-mix(in srgb, var(--color-white) 78%, transparent);
					background: color-mix(in srgb, var(--color-white) 3.5%, transparent);
				}

				&.active {
					color: var(--color-white);
					background: color-mix(in srgb, var(--color-white) 7.5%, transparent);
				}
			}
		}

		&__user {
			display: flex;
			align-items: center;
			gap: 10px;
		}

		&__avatar {
			width: 24px;
			height: 24px;
			border-radius: 50%;
			border: 1px solid var(--color-white-12);
		}

		&__name {
			color: color-mix(in srgb, var(--color-white) 60%, transparent);
			font-size: 12px;
			font-weight: 500;
		}

		&__logout {
			background: transparent;
			border: 1px solid var(--color-white-10);
			color: color-mix(in srgb, var(--color-white) 54%, transparent);
			padding: 5px 10px;
			border-radius: 999px;
			cursor: pointer;
			font-size: 12px;
			font-weight: 500;
			transition: all 0.2s ease;

			&:hover {
				background: var(--color-white-04);
				border-color: color-mix(in srgb, var(--color-white) 16%, transparent);
				color: var(--color-white-82);
			}
		}

		&__main {
			flex: 1;
		}
	}

	@media (max-width: 700px) {
		.calendar-shell {
			&__nav-inner {
				padding: 10px 14px;
				gap: 12px;
				height: auto;
				min-height: 48px;
				flex-wrap: wrap;
			}

			&__links {
				order: 3;
				width: 100%;
				overflow-x: auto;
				padding-bottom: 2px;
				gap: 4px;

				a {
					font-size: 12px;
					padding: 5px 9px;
					white-space: nowrap;
				}
			}

			&__name {
				display: none;
			}
		}
	}
</style>
