<script lang="ts">
	import type { NavItem } from '$lib/layout/nav'

	type FooterNavProps = {
		primaryItems: NavItem[]
		legalItems: NavItem[]
	}

	const { primaryItems, legalItems }: FooterNavProps = $props()
</script>

<footer class="layout-footer">
	<nav class="layout-footer__nav">
		<span class="layout-footer__group">
			{#each primaryItems as item}
				<a href={item.href} class="layout-footer__link">{item.label}</a>
			{/each}
		</span>
		<span class="layout-footer__divider" aria-hidden="true"></span>
		<span class="layout-footer__group">
			{#each legalItems as item}
				<a href={item.href} class="layout-footer__link">{item.label}</a>
			{/each}
		</span>
	</nav>
	<small class="layout-footer__copyright">© {new Date().getFullYear()} Miko Meow™</small>
</footer>
