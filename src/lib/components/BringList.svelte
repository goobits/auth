<script lang="ts">
	let { items } = $props<{ items: string[] }>();
</script>

<section class="layout__section bring-list" id="bring">
	<div class="layout__container">
		<h2 class="layout__title">What to bring</h2>
		<ul class="bring-list__items">
			{#each items as item (item)}
				<li>{item}</li>
			{/each}
		</ul>
		<p class="bring-list__note">Please pack out what you pack in. Leave Mt. Tabor lovelier than you found it.</p>
	</div>
</section>
