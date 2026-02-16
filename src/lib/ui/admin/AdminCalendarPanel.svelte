<script>
	import { Save, Loader } from '@lucide/svelte'
	const { dashboard } = $props()
</script>

<h1 class="admin-page__title">Availability</h1>
<p class="admin-page__subtitle">Configure booking rules and slot behavior.</p>

<div class="admin-page__section">
	<div class="admin-page__section-head">
		<h3 class="admin-page__section-title">Booking rules</h3>
	</div>
	<p class="admin-page__section-description">Define when friends can book, and how much runway you need between sessions.</p>
	<div class="admin-page__fields-grid">
		<div class="admin-page__fields-row">
			<div class="admin-page__field">
				<span class="admin-page__field-label">Operating hours</span>
				<div class="admin-page__time-row">
					<input class="admin-page__input admin-page__input--time" type="time" bind:value={dashboard.hours.from} aria-label="Opening time" />
					<span class="admin-page__time-separator">to</span>
					<input class="admin-page__input admin-page__input--time" type="time" bind:value={dashboard.hours.to} aria-label="Closing time" />
				</div>
			</div>
		</div>
		<div class="admin-page__fields-row">
			<div class="admin-page__field">
				<label class="admin-page__field-label">
					Buffer between slots
					<div class="admin-page__input-wrap">
						<input class="admin-page__input admin-page__input--number" type="number" min="0" bind:value={dashboard.buffer} />
						<span class="admin-page__input-suffix">min</span>
					</div>
				</label>
			</div>
			<div class="admin-page__field">
				<label class="admin-page__field-label">
					Minimum notice
					<div class="admin-page__input-wrap">
						<input class="admin-page__input admin-page__input--number" type="number" min="1" bind:value={dashboard.notice} />
						<span class="admin-page__input-suffix">hrs</span>
					</div>
				</label>
			</div>
			<div class="admin-page__field">
				<label class="admin-page__field-label">
					Capacity per slot
					<div class="admin-page__input-wrap">
						<input class="admin-page__input admin-page__input--number" type="number" min="1" bind:value={dashboard.capacity} />
						<span class="admin-page__input-suffix">people</span>
					</div>
				</label>
			</div>
		</div>
	</div>
	<button class="admin-page__button-secondary" onclick={dashboard.save} disabled={dashboard.saving}>
		{#if dashboard.saving}
			<Loader size={12} class="admin-page__spin" />
			Saving...
		{:else}
			<Save size={12} />
			Save rules
		{/if}
	</button>
</div>
