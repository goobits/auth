<script lang="ts">
	import type { DonationContent } from '$lib/content/engagement';

	let { donation } = $props<{
		donation: DonationContent;
	}>();

	const hasDonateLink = $derived.by(
		() => Boolean(donation.onlineUrl ?? donation.venmoUrl ?? donation.paypalUrl)
	);
</script>

<section class="layout__section donate" id="donate">
	<div class="layout__container">
		<div class="donate__panel">
			<div>
				<h2 class="layout__title donate__title">{donation.headline}</h2>
				<p class="donate__copy">{donation.body}</p>
				<ul class="donate__list">
					{#each donation.bullets as bullet (bullet)}
						<li class="donate__item"><span class="donate__item-arrow" aria-hidden="true">→</span>{bullet}</li>
					{/each}
				</ul>
				<p class="donate__disclaimer">{donation.disclaimer}</p>
			</div>
			<div class="donate__actions">
				{#if donation.onlineUrl}
					<a class="c-button c-button--accent c-button--large" href={donation.onlineUrl}>Donate Online</a>
				{/if}
				{#if donation.venmoUrl}
					<a class="c-button c-button--secondary" href={donation.venmoUrl}>Venmo</a>
				{/if}
				{#if donation.paypalUrl}
					<a class="c-button c-button--secondary" href={donation.paypalUrl}>PayPal</a>
				{/if}
				{#if !hasDonateLink}
					<p class="donate__coming-soon">
						Donations open soon. Want a reminder when they go live? Use the reminder form below.
					</p>
				{/if}
			</div>
		</div>
	</div>
</section>
