<script lang="ts">
	import type { Route } from '$lib/content/site';

	let { routes } = $props<{ routes: Route[] }>();
</script>

<section class="layout__section routes" id="routes">
	<div class="layout__container">
		<p class="layout__eyebrow">Choose your loop</p>
		<h2 class="layout__title">Three routes, zero pressure</h2>
		<p class="routes__intro">Pick the one that matches your day. Walk, jog, or run, all good.</p>

		<div class="routes__grid">
			{#each routes as route (route.id)}
				<article class={`routes__card routes__card--${route.accent}`}>
					<div class="routes__banner" aria-hidden="true"></div>
					<div class="routes__body">
						<div class="routes__icon" aria-hidden="true">{route.icon}</div>
						<h3 class="routes__card-title">{route.title}</h3>
						<p class="routes__distance">{route.distance}</p>
						<p class="routes__description">{route.description}</p>
						<div class="routes__meta">
							<span><i></i>{route.surface}</span>
							<span><i></i>{route.hills}</span>
							<span><i></i>{route.note}</span>
						</div>
						<div class="routes__links">
							<a href={route.pdf}>PDF</a>
							<a href={route.gpx}>GPX</a>
						</div>
					</div>
				</article>
			{/each}
		</div>

		<p class="routes__safety">Routes are marked and supported by friendly marshals. Please yield kindly at crossings.</p>
	</div>
</section>
