<script lang="ts">
	import type { NavItem } from '$lib/layout/nav'

	type FooterNavProps = {
		primaryItems: NavItem[]
		elsewhereItems?: NavItem[]
		legalItems: NavItem[]
	}

	const { primaryItems, elsewhereItems = [], legalItems }: FooterNavProps = $props()

	const year = new Date().getFullYear()
</script>

<footer class="layout-footer">
	<div class="layout-footer__inner">
		<div class="layout-footer__top">
			<div class="layout-footer__brand">
				<a href="/" class="layout-footer__brand-link">Miko</a>
				<p class="layout-footer__tagline">Developer, designer &amp; musician 🦄</p>
				<small class="layout-footer__copyright">© {year} Miko Meow™</small>
			</div>

			<div class="layout-footer__columns" aria-label="Footer links">
				<div class="layout-footer__col">
					<h3>More</h3>
					<ul>
						{#each primaryItems as item}
							<li><a class="layout-footer__col-link" href={item.href}>{item.label}</a></li>
						{/each}
					</ul>
				</div>

				{#if elsewhereItems.length}
					<div class="layout-footer__col">
						<h3>Elsewhere</h3>
						<ul>
							{#each elsewhereItems as item}
								<li>
									<a
										class="layout-footer__col-link"
										href={item.href}
										target={item.external ? '_blank' : undefined}
										rel={item.external ? 'noreferrer noopener nofollow' : undefined}
									>
										{item.label}{item.external ? ' ↗' : ''}
									</a>
								</li>
							{/each}
						</ul>
					</div>
				{/if}

				<div class="layout-footer__col">
					<h3>Legal</h3>
					<ul>
						{#each legalItems as item}
							<li><a class="layout-footer__col-link" href={item.href}>{item.label}</a></li>
						{/each}
						<li><a class="layout-footer__col-link" href="/sitemap">Sitemap</a></li>
					</ul>
				</div>
			</div>
		</div>
	</div>
</footer>
