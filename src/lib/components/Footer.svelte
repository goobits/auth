<script lang="ts">
	let { brand, line, year } = $props<{ brand: string; line: string; year: number }>();
</script>

<footer class="site-footer">
	<div class="layout__container">
		<div class="site-footer__top">
			<div>
				<span class="site-footer__brand">{brand}</span>
				<p class="site-footer__tagline">{line}</p>
			</div>
			<nav class="site-footer__nav" aria-label="Footer links">
				<a class="site-footer__link" href="mailto:hello@pdx.run">Contact</a>
				<a class="site-footer__link" href="/volunteer">Volunteer</a>
				<a class="site-footer__link" href="/donate">Donate</a>
				<a class="site-footer__link" href="/code-of-conduct">Code of Conduct</a>
			</nav>
		</div>
		<div class="site-footer__bottom">
			<small class="site-footer__small">© {year} PDX Dino Run</small>
			<small class="site-footer__small">Leave no fossils behind</small>
		</div>
	</div>
</footer>
