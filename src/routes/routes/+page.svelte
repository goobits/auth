<script lang="ts">
	import RoutesTabs from '$lib/components/RoutesTabs.svelte';
	import { site } from '$lib/content/site';
</script>

<svelte:head>
	<title>Routes | pdx.run</title>
</svelte:head>

<main>
	<RoutesTabs routes={site.routes} />
	<section class="layout__section flow-page">
		<div class="layout__container">
			<div class="flow-links">
				<a class="c-button c-button--primary c-button--large" href="/join">Join the Herd</a>
				<a class="c-button c-button--secondary" href="/">Back Home</a>
			</div>
		</div>
	</section>
</main>
