<script>
	import { page } from '$app/stores'

	const links = [
		{ href: '/admin/calendar', label: 'Calendar' }
	]
</script>

<section class="admin">
	<header class="admin-header">
		<div>
			<h1>Rainbow Gym Admin</h1>
			<p class="muted">Keep scheduling calm, clean, and in sync.</p>
		</div>
		{#if $page.url.pathname !== '/admin'}
			<nav class="admin-nav">
				{#each links as link}
					<a
						class:active={$page.url.pathname === link.href || $page.url.pathname.startsWith(`${link.href}/`)}
						href={link.href}
					>
						{link.label}
					</a>
				{/each}
			</nav>
		{/if}
	</header>

	<section class="admin-panel">
		<slot />
	</section>
</section>
