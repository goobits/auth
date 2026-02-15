<script lang="ts">
	import type { NavItem } from '$lib/layout/nav'

	type FooterNavProps = {
		primaryItems: NavItem[]
		legalItems: NavItem[]
	}

	const { primaryItems, legalItems }: FooterNavProps = $props()
</script>

<footer class="layout-footer">
	<nav>
		<span class="layout-footer__group">
			{#each primaryItems as item}
				<a href={item.href}>{item.label}</a>
			{/each}
		</span>
		<span class="layout-footer__divider" aria-hidden="true"></span>
		<span class="layout-footer__group">
			{#each legalItems as item}
				<a href={item.href}>{item.label}</a>
			{/each}
		</span>
	</nav>
	<small>© {new Date().getFullYear()} Miko Meow™</small>
</footer>
