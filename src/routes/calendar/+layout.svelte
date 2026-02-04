<script>
	import { page } from '$app/stores'
	import { goto } from '$app/navigation'
	import './Calendar.scss'

	const { data, children } = $props()

	const navItems = [
		{ href: '/calendar/gym', label: 'Gym' },
		{ href: '/calendar/circus', label: 'Circus' },
		{ href: '/calendar/adventure', label: 'Adventure' },
		{ href: '/calendar/movie-night', label: 'Movies' }
	]

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
	<nav class="calendar-nav">
		<div class="nav-inner">
			<a href="/calendar" class="nav-brand">Members</a>
			<div class="nav-links">
				{#each navItems as item}
					<a
						href={item.href}
						class:active={isActive(item.href, item.exact)}
					>
						{item.label}
					</a>
				{/each}
			</div>
			<div class="nav-user">
				{#if data.user}
					{#if data.user.avatarUrl}
						<img src={data.user.avatarUrl} alt="" class="avatar" />
					{/if}
					<span class="user-name">{data.user.name || data.user.email}</span>
					<button onclick={logout} class="logout-btn">Logout</button>
				{/if}
			</div>
		</div>
	</nav>

	<div class="calendar-layout">
		<main class="calendar-main">
			{@render children()}
		</main>
	</div>
</div>

<style>
	.calendar-layout {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	.calendar-nav {
		background: rgba(255, 255, 255, 0.02);
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
		width: 100%;
		position: sticky;
		top: 0;
		z-index: 100;
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
	}

	.nav-inner {
		max-width: var(--max-width, 1060px);
		margin: 0 auto;
		width: calc(100% - 2em);
		padding: 0;
		height: 56px;
		display: flex;
		align-items: center;
		gap: 32px;
	}

	.nav-brand {
		font-size: 17px;
		font-weight: 600;
		letter-spacing: -0.01em;
		background: linear-gradient(90deg, #ff6b6b, #feca57, #48dbfb, #ff9ff3, #a78bfa);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		text-decoration: none;
	}

	.nav-links {
		display: flex;
		gap: 8px;
		flex: 1;
	}

	.nav-links a {
		color: rgba(245, 245, 247, 0.56);
		text-decoration: none;
		font-size: 14px;
		font-weight: 500;
		padding: 8px 14px;
		border-radius: 8px;
		transition: all 0.2s ease;
	}

	.nav-links a:hover {
		color: rgba(245, 245, 247, 0.8);
		background: rgba(255, 255, 255, 0.04);
	}

	.nav-links a.active {
		color: #f5f5f7;
		background: rgba(255, 255, 255, 0.08);
	}

	.nav-user {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.avatar {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		border: 1px solid rgba(255, 255, 255, 0.1);
	}

	.user-name {
		color: rgba(245, 245, 247, 0.7);
		font-size: 13px;
		font-weight: 500;
	}

	.logout-btn {
		background: transparent;
		border: 1px solid rgba(255, 255, 255, 0.1);
		color: rgba(245, 245, 247, 0.56);
		padding: 6px 12px;
		border-radius: 6px;
		cursor: pointer;
		font-size: 13px;
		font-weight: 500;
		transition: all 0.2s ease;
	}

	.logout-btn:hover {
		background: rgba(255, 255, 255, 0.04);
		border-color: rgba(255, 255, 255, 0.15);
		color: rgba(245, 245, 247, 0.8);
	}

	.calendar-main {
		flex: 1;
	}

	@media (max-width: 700px) {
		.nav-inner {
			padding: 12px 16px;
			gap: 16px;
			height: auto;
			min-height: 56px;
			flex-wrap: wrap;
		}

		.nav-links {
			order: 3;
			width: 100%;
			overflow-x: auto;
			padding-bottom: 4px;
			gap: 4px;
		}

		.nav-links a {
			font-size: 13px;
			padding: 6px 10px;
			white-space: nowrap;
		}

		.user-name {
			display: none;
		}
	}
</style>
