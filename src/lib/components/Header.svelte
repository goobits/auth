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
		<a href="#top" class="site-header__brand">🦖 PDX Dino Run</a>

		<nav class="site-header__nav" aria-label="Primary">
			{#each nav as item (item.id)}
				<a
					href={`#${item.id}`}
					class={`site-header__link ${active === item.id ? 'site-header__link--active' : ''}`}
					aria-current={active === item.id ? 'page' : undefined}
				>
					{item.label}
				</a>
			{/each}
		</nav>

		<div class="site-header__actions">
			<a class="c-button c-button--ghost" href="#donate">Donate</a>
			<a class="c-button c-button--primary" href="#volunteer">Join the Herd</a>
		</div>

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
					<a class="site-header__mobile-link" href={`#${item.id}`} onclick={closeMenu}>{item.label}</a>
				{/each}
				<div class="site-header__mobile-actions">
					<a class="c-button c-button--ghost" href="#donate" onclick={closeMenu}>Donate</a>
					<a class="c-button c-button--primary" href="#volunteer" onclick={closeMenu}>Join the Herd</a>
				</div>
			</div>
		</div>
	{/if}
</header>
