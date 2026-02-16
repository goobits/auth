<script lang="ts">
	let { items } = $props<{ items: { icon: string; label: string }[] }>();
</script>

<section class="layout__section bring-list" id="bring">
	<div class="layout__container">
		<p class="layout__eyebrow">Be prepared</p>
		<h2 class="layout__title bring-list__title">What to bring</h2>
		<div class="bring-list__items">
			{#each items as item (item.label)}
				<div class="bring-list__pill"><span>{item.icon}</span>{item.label}</div>
			{/each}
		</div>
		<p class="bring-list__note">Leave no fossils behind. Pack out what you pack in.</p>
	</div>
</section>
