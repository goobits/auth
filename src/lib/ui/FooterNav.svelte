<script lang="ts">
	import type { NavItem } from '$lib/layout/nav'

	type FooterNavProps = {
		primaryItems: NavItem[]
		legalItems: NavItem[]
	}

	const { primaryItems, legalItems }: FooterNavProps = $props()

	const sitemapItem = $derived(primaryItems.find((item) => item.href === '/sitemap') ?? null)
	const primaryCoreItems = $derived(primaryItems.filter((item) => item.href !== '/sitemap'))
</script>

	<footer class="layout-footer">
		<nav class="layout-footer__nav">
			<span class="layout-footer__group">
				{#each primaryCoreItems as item}
					<a href={item.href} class="layout-footer__link">{item.label}</a>
				{/each}
			</span>
			<span class="layout-footer__divider" aria-hidden="true"></span>
			<span class="layout-footer__group">
				{#each legalItems as item}
					<a href={item.href} class="layout-footer__link">{item.label}</a>
				{/each}
			</span>
			{#if sitemapItem}
				<span class="layout-footer__divider" aria-hidden="true"></span>
				<a href={sitemapItem.href} class="layout-footer__link">{sitemapItem.label}</a>
			{/if}
		</nav>
		<small class="layout-footer__copyright">© {new Date().getFullYear()} Miko Meow™</small>
	</footer>
