<script lang="ts">
	import type { Snippet } from 'svelte'

	export type ShellNavLink = {
		href: string
		label: string
		exact?: boolean
	}

	type ShellNavProps = {
		homeHref?: string
		brandLabel?: string
		brandHref?: string
		links?: ShellNavLink[]
		currentPath: string
		right?: Snippet
	}

	const { homeHref = '/', brandLabel, brandHref, links = [], currentPath, right }: ShellNavProps = $props()

	function isActive(href: string, exact = false) {
		if (exact) return currentPath === href || currentPath === `${href}/`
		return currentPath === href || currentPath.startsWith(`${href}/`)
	}
</script>

<nav class="shell-nav">
	<div class="shell-nav__inner">
		<a href={homeHref} class="shell-nav__home" aria-label="Home">
			<img src="/media/logo.svg" alt="MIKO.ART" class="shell-nav__home-logo" />
		</a>
		{#if brandLabel && brandHref}
			<a href={brandHref} class="shell-nav__brand">{brandLabel}</a>
		{/if}

		{#if links.length > 0}
			<div class="shell-nav__links">
				{#each links as item (item.href)}
					<a
						href={item.href}
						class="shell-nav__link"
						class:shell-nav__link--active={isActive(item.href, item.exact)}
					>
						{item.label}
					</a>
				{/each}
			</div>
		{/if}

		<div class="shell-nav__right">
			{@render right?.()}
		</div>
	</div>
</nav>

<style lang="scss">
	.shell-nav {
		background: var(--color-white-015);
		border-bottom: var(--border-width) solid var(--color-white-05);
		width: 100%;
		position: sticky;
		top: 0;
		z-index: 80;
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
	}

	.shell-nav__inner {
		max-width: var(--max-width, 1060px);
		margin: 0 auto;
		width: var(--calendar-nav-inner-width);
		height: var(--calendar-nav-height);
		display: flex;
		align-items: center;
		gap: var(--calendar-nav-inner-gap);
	}

	.shell-nav__home {
		display: inline-flex;
		align-items: center;
		text-decoration: none;
	}

	.shell-nav__home-logo {
		display: block;
		height: 28px;
		width: auto;
		filter: none;
	}

	.shell-nav__brand {
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

	.shell-nav__links {
		display: flex;
		gap: var(--calendar-nav-link-gap);
		flex: 1;
		align-items: center;
		min-width: 0;
	}

	.shell-nav__link {
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

	.shell-nav__link:hover {
		color: color-mix(in srgb, var(--color-white) 78%, transparent);
		background: color-mix(in srgb, var(--color-white) 3.5%, transparent);
	}

	.shell-nav__link--active {
		color: var(--color-white);
		background: color-mix(in srgb, var(--color-white) 7.5%, transparent);
		text-decoration: underline;
		text-underline-offset: 0.22em;
	}

	.shell-nav__right {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	:global(.shell-nav__user) {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	:global(.shell-nav__avatar) {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		border: var(--border-width) solid var(--color-white-12);
	}

	:global(.shell-nav__name) {
		color: color-mix(in srgb, var(--color-white) 60%, transparent);
		font-size: 12px;
		font-weight: var(--font-weight-medium);
	}

	:global(.shell-nav__button) {
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

	:global(.shell-nav__button:hover) {
		background: var(--color-white-04);
		border-color: color-mix(in srgb, var(--color-white) 16%, transparent);
		color: var(--color-white-82);
	}

	:global(.shell-nav__badge) {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 12px;
		font-weight: var(--font-weight-medium);
		color: color-mix(in srgb, var(--color-white) 62%, transparent);
		border: var(--border-width) solid var(--color-white-10);
		background: color-mix(in srgb, var(--color-white) 2.5%, transparent);
		padding: var(--space-1) var(--space-3);
		border-radius: var(--radius-pill);
	}

	@media (max-width: 700px) {
		.shell-nav__inner {
			padding: var(--space-3) var(--space-4);
			gap: var(--space-3);
			height: auto;
			min-height: 48px;
			flex-wrap: wrap;
		}

		.shell-nav__links {
			order: 3;
			width: 100%;
			overflow-x: auto;
			padding-bottom: var(--space-1);
			gap: var(--space-1);
		}

		.shell-nav__link {
			font-size: 12px;
			padding: var(--space-1) var(--space-2);
			white-space: nowrap;
		}

		:global(.shell-nav__name) {
			display: none;
		}
	}
</style>
