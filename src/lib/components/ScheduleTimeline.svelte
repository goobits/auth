<script lang="ts">
	let { items } = $props<{ items: string[] }>();
</script>

<section class="layout__section schedule" id="schedule">
	<div class="layout__container">
		<h2 class="layout__title">Schedule</h2>
		<p class="schedule__note">Times are approximate. This is a joy-first community day.</p>
		<ol class="schedule__list">
			{#each items as item (item)}
				<li class="schedule__item">{item}</li>
			{/each}
		</ol>
	</div>
</section>
