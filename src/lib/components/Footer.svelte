<script lang="ts">
	let { line, year } = $props<{ line: string; year: number }>();
</script>

<footer class="site-footer">
	<div class="layout__container site-footer__inner">
		<p class="site-footer__line">{line}</p>
		<nav class="site-footer__nav" aria-label="Footer links">
			<a class="site-footer__link" href="mailto:hello@pdxdinorun.org">Contact</a>
			<a class="site-footer__link" href="#volunteer">Volunteer</a>
			<a class="site-footer__link" href="#donate">Donate</a>
			<a class="site-footer__link" href="/code-of-conduct.html">Code of Conduct</a>
			<a class="site-footer__link" href="#about">Accessibility Notes</a>
		</nav>
		<small class="site-footer__small">© {year} PDX Dino Run</small>
	</div>
</footer>
