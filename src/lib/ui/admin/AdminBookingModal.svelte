<script>
	import { Loader } from '@lucide/svelte'
	const { dashboard } = $props()
</script>

{#if dashboard.viewBooking}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div class="admin-page__modal-overlay" role="dialog" aria-modal="true" tabindex="-1" onclick={() => dashboard.viewBooking = null} onkeydown={(e) => e.key === 'Escape' && (dashboard.viewBooking = null)}>
		<div class="admin-page__modal-card" role="document" onkeydown={() => {}} onclick={(e) => e.stopPropagation()}>
			<h3 class="admin-page__modal-title">Booking details</h3>
			<p class="admin-page__modal-subtitle">Here's what we have on file.</p>
			<div class="admin-page__modal-rows">
				<div class="admin-page__modal-row">
					<span class="admin-page__modal-label">Date</span>
					<span class="admin-page__modal-value">{dashboard.viewBooking.date}</span>
				</div>
				<div class="admin-page__modal-row">
					<span class="admin-page__modal-label">Time</span>
					<span class="admin-page__modal-value">{dashboard.viewBooking.time}</span>
				</div>
				<div class="admin-page__modal-row">
					<span class="admin-page__modal-label">Guest</span>
					<span class="admin-page__modal-value">{dashboard.viewBooking.name}</span>
				</div>
				<div class="admin-page__modal-row">
					<span class="admin-page__modal-label">Email</span>
					<span class="admin-page__modal-value">{dashboard.viewBooking.email}</span>
				</div>
				<div class="admin-page__modal-row">
					<span class="admin-page__modal-label">Seats</span>
					<span class="admin-page__modal-value">{dashboard.viewBooking.seats}</span>
				</div>
				{#if dashboard.viewBooking.note}
					<div class="admin-page__modal-row">
						<span class="admin-page__modal-label">Note</span>
						<span class="admin-page__modal-value">{dashboard.viewBooking.note}</span>
					</div>
				{/if}
				<div class="admin-page__modal-row">
					<span class="admin-page__modal-label">Status</span>
					<span class="admin-page__modal-value">{dashboard.viewBooking.status === 'confirmed' ? 'Confirmed' : 'Pending'}</span>
				</div>
			</div>
			<div class="admin-page__modal-actions">
				<button class="admin-page__button-primary" onclick={() => dashboard.viewBooking = null}>Done</button>
				<button class="admin-page__button-secondary admin-page__button-secondary--danger" onclick={() => dashboard.cancelBooking(dashboard.viewBooking.id)} disabled={dashboard.canceling}>
					{#if dashboard.canceling}
						<Loader size={12} class="admin-page__spin" />
						Canceling...
					{:else}
						Cancel booking
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}
