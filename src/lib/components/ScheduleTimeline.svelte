<script lang="ts">
	let { items } = $props<{ items: { time: string; label: string; featured: boolean }[] }>();
</script>

<section class="layout__section schedule" id="schedule">
	<div class="layout__container">
		<p class="layout__eyebrow layout__eyebrow--inverse">Day of</p>
		<h2 class="layout__title schedule__title">Schedule</h2>
		<p class="schedule__note">Times are approximate. This is a joy-first community day.</p>
		<div class="schedule__timeline">
			{#each items as item (`${item.time}-${item.label}`)}
				<div class="schedule__item">
					<span class="schedule__time">{item.time}</span>
					<p class="schedule__label">
						{#if item.featured}
							<strong>{item.label}</strong>
						{:else}
							{item.label}
						{/if}
					</p>
				</div>
			{/each}
		</div>
	</div>
</section>
