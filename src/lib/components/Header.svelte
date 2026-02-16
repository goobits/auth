<script lang="ts">
	import { onMount } from 'svelte';

	type NavItem = { id: string; label: string };

	let { nav } = $props<{ nav: NavItem[] }>();
	let menuOpen = $state(false);
	let active = $state('');

	$effect(() => {
		if (!active && nav[0]?.id) active = nav[0].id;
	});

	function closeMenu() {
		menuOpen = false;
	}

	onMount(() => {
		const sections = nav
			.map((item: NavItem) => document.getElementById(item.id))
			.filter((node: HTMLElement | null): node is HTMLElement => node !== null);

		const observer = new IntersectionObserver(
			(entries) => {
				const visible = entries
					.filter((entry) => entry.isIntersecting)
					.sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
				if (visible?.target.id) active = visible.target.id;
			},
			{ threshold: [0.2, 0.5, 0.8], rootMargin: '-120px 0px -45% 0px' }
		);

		sections.forEach((section: HTMLElement) => {
			observer.observe(section);
		});
		return () => {
			observer.disconnect();
		};
	});
</script>

<header class="site-header">
	<div class="layout__container site-header__inner">
		<a href="#top" class="site-header__brand" aria-label="pdx.run home">
			<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
				<path
					d="M12 3C7 3 4 6 4 9c0 2 1 3.5 2.5 4.5-.5 1-1.5 2.5-1.5 4 0 2.5 2 4.5 4.5 4.5 1 0 2-.5 2.5-1 .5.5 1.5 1 2.5 1 2.5 0 4.5-2 4.5-4.5 0-1.5-1-3-1.5-4C19 12.5 20 11 20 9c0-3-3-6-8-6z"
					fill="currentColor"
					opacity="0.6"
				/>
				<circle cx="9" cy="9" r="1.5" fill="currentColor" />
				<circle cx="15" cy="9" r="1.5" fill="currentColor" />
			</svg>
			<span>pdx.run</span>
		</a>

		<nav class="site-header__nav" aria-label="Primary">
			{#each nav as item (item.id)}
				<a
					href={`/#${item.id}`}
					class={`site-header__link ${active === item.id ? 'site-header__link--active' : ''}`}
					aria-current={active === item.id ? 'page' : undefined}
				>
					{item.label}
				</a>
			{/each}
			<a class="c-button c-button--primary c-button--compact" href="/join">Join the Herd</a>
		</nav>

		<button
			class="site-header__menu-button"
			type="button"
			onclick={() => {
				menuOpen = !menuOpen;
			}}
			aria-expanded={menuOpen}
		>
			Menu
		</button>
	</div>

	{#if menuOpen}
		<div class="site-header__mobile">
			<div class="layout__container site-header__mobile-inner">
				{#each nav as item (item.id)}
					<a class="site-header__mobile-link" href={`/#${item.id}`} onclick={closeMenu}>{item.label}</a>
				{/each}
				<div class="site-header__mobile-actions">
					<a class="c-button c-button--secondary" href="/donate" onclick={closeMenu}>Donate</a>
					<a class="c-button c-button--primary" href="/join" onclick={closeMenu}>Join</a>
				</div>
			</div>
		</div>
	{/if}
</header>
