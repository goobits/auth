<script lang="ts">
	import type { NavItem } from '$lib/layout/nav'
	import ThemeSelect from '$lib/ui/ThemeSelect.svelte'

	type TopbarProps = {
		items: NavItem[]
		currentPath: string
	}

	const { items, currentPath }: TopbarProps = $props()

	function normalizePath(path: string) {
		if (!path || path === '/') return '/'
		return path.endsWith('/') ? path.slice(0, -1) : path
	}

	function isActive(item: NavItem) {
		const path = normalizePath(currentPath)
		const href = normalizePath(item.href)
		if (href === '/') return path === '/'
		if (item.matchPrefix) return path === href || path.startsWith(`${href}/`)
		return path === href
	}
</script>

<header class="layout-header">
	<div class="layout-header__inner">
		<div class="layout-header__left">
			<div class="layout-header__logo">
				<a href="/" class="layout-header__logo-link">
					<img src="/media/logo.svg" alt="logo" class="layout-header__logo-image" />
				</a>
			</div>
			<nav class="layout-header__nav">
				{#each items as item}
					<a
						href={item.href}
						class="layout-header__nav-link"
						class:layout-header__nav-link--active={isActive(item)}
					>
						{item.label}
					</a>
				{/each}
			</nav>
		</div>
		<div class="layout-header__theme">
			<ThemeSelect />
		</div>
	</div>
</header>
