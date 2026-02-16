<script lang="ts">
	import type { Route } from '$lib/content/site';

	let { routes } = $props<{ routes: Route[] }>();
	let active = $state('');
	$effect(() => {
		if (!active && routes[0]?.id) active = routes[0].id;
	});
	let current = $derived(routes.find((route) => route.id === active) ?? routes[0]);
</script>

<section class="layout__section routes" id="routes">
	<div class="layout__container">
		<h2 class="layout__title">Choose your loop</h2>
		<p class="routes__intro">Pick the route that matches your day. You can walk, jog, or run.</p>

		<div class="routes__tabs" role="tablist" aria-label="Route options">
			{#each routes as route}
				<button
					class={`routes__tab ${active === route.id ? 'routes__tab--active' : ''}`}
					type="button"
					role="tab"
					aria-selected={active === route.id}
					onclick={() => (active = route.id)}
				>
					{route.tab}
				</button>
			{/each}
		</div>

		{#if current}
			<div class="routes__panel" role="tabpanel">
				<div class="routes__meta">
					<h3 class="routes__meta-title">{current.title}</h3>
					<ul class="routes__meta-list">
						<li><strong>Distance:</strong> {current.distance}</li>
						<li><strong>Good for:</strong> {current.goodFor}</li>
						<li><strong>Surface:</strong> {current.surface}</li>
						<li><strong>Hills:</strong> {current.hills}</li>
					</ul>
					<div class="routes__links">
						<a href={current.pdf}>Download PDF</a>
						<a href={current.gpx}>Download GPX</a>
					</div>
				</div>
				<div class="routes__map" aria-label={current.mapLabel}>
					<span class="routes__map-label">{current.mapLabel}</span>
				</div>
			</div>
		{/if}

		<p class="routes__safety">
			Routes are marked and supported by friendly marshals. Please yield kindly and keep an eye
			out at crossings.
		</p>
	</div>
</section>
