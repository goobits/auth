<script>
	import { page } from '$app/stores'
	import { goto } from '$app/navigation'
	import { ThemeToggle } from '@goobits/themes/svelte'

	const { data, children } = $props()

	const navItems = [
		{ href: '/rainbow', label: 'Home', exact: true },
		{ href: '/rainbow/gym', label: 'Gym' },
		{ href: '/rainbow/circus', label: 'Circus' },
		{ href: '/rainbow/adventure', label: 'Adventure' },
		{ href: '/rainbow/movie-night', label: 'Movie Night' }
	]

	function isActive(href, exact = false) {
		if (exact) return $page.url.pathname === href
		return $page.url.pathname.startsWith(href)
	}

	async function logout() {
		await fetch('/api/rainbow/auth/logout', { method: 'POST' })
		goto('/rainbow/login')
	}
</script>

<div class="rainbow-layout">
	<nav class="rainbow-nav">
		<div class="nav-brand">
			<a href="/rainbow">Rainbow</a>
		</div>
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
				<div class="user-menu">
					{#if data.user.avatarUrl}
						<img src={data.user.avatarUrl} alt="" class="avatar" />
					{/if}
					<span class="user-name">{data.user.name || data.user.email}</span>
					<button onclick={logout} class="logout-btn">Logout</button>
				</div>
			{/if}
			<ThemeToggle />
		</div>
	</nav>

	<main class="rainbow-main">
		{@render children()}
	</main>
</div>

<style>
	.rainbow-layout {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}

	.rainbow-nav {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		padding: 0.75rem 1.5rem;
		display: flex;
		align-items: center;
		gap: 2rem;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.nav-brand a {
		color: white;
		font-size: 1.5rem;
		font-weight: 700;
		text-decoration: none;
	}

	.nav-links {
		display: flex;
		gap: 1.5rem;
		flex: 1;
	}

	.nav-links a {
		color: rgba(255, 255, 255, 0.85);
		text-decoration: none;
		font-weight: 500;
		padding: 0.5rem 0;
		border-bottom: 2px solid transparent;
		transition: all 0.2s;
	}

	.nav-links a:hover {
		color: white;
	}

	.nav-links a.active {
		color: white;
		border-bottom-color: white;
	}

	.nav-user {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.user-menu {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.avatar {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		border: 2px solid rgba(255, 255, 255, 0.5);
	}

	.user-name {
		color: white;
		font-size: 0.9rem;
	}

	.logout-btn {
		background: rgba(255, 255, 255, 0.2);
		border: 1px solid rgba(255, 255, 255, 0.3);
		color: white;
		padding: 0.4rem 0.8rem;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.85rem;
		transition: background 0.2s;
	}

	.logout-btn:hover {
		background: rgba(255, 255, 255, 0.3);
	}

	.rainbow-main {
		flex: 1;
		padding: 2rem;
		max-width: 1200px;
		margin: 0 auto;
		width: 100%;
	}

	:global(.rainbow-nav button) {
		background: transparent;
		border: none;
		color: white;
		cursor: pointer;
	}

	:global(.rainbow-nav svg) {
		width: 24px;
		height: 24px;
	}

	@media (max-width: 768px) {
		.rainbow-nav {
			flex-wrap: wrap;
			gap: 1rem;
		}

		.nav-links {
			order: 3;
			width: 100%;
			overflow-x: auto;
		}

		.user-name {
			display: none;
		}
	}
</style>
