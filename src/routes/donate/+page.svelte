<script lang="ts">
	import { donation } from '$lib/content/engagement';

	const donateLinks = [
		{ label: 'Donate Online', url: donation.onlineUrl, kind: 'accent' },
		{ label: 'Donate via Venmo', url: donation.venmoUrl, kind: 'secondary' },
		{ label: 'Donate via PayPal', url: donation.paypalUrl, kind: 'secondary' }
	] as const;

	const hasDonateLink = Boolean(donation.onlineUrl ?? donation.venmoUrl ?? donation.paypalUrl);
</script>

<svelte:head>
	<title>Donate | pdx.run</title>
</svelte:head>

<section class="flow-page">
	<div class="layout__container">
		<div class="flow-page__card">
			<p class="layout__eyebrow">Support the event</p>
			<h1 class="layout__title">Donation options</h1>
			<p class="flow-page__copy">{donation.body}</p>
			{#if hasDonateLink}
				<div class="flow-links">
					{#each donateLinks as link (link.label)}
						{#if link.url}
							<a
								class={`c-button ${link.kind === 'accent' ? 'c-button--accent c-button--large' : 'c-button--secondary'}`}
								href={link.url}
							>
								{link.label}
							</a>
						{/if}
					{/each}
				</div>
			{:else}
				<p class="flow-page__copy">Donations open soon. Want a reminder when they go live?</p>
				<div class="flow-links">
					<a class="c-button c-button--primary" href="/#remind">Get Donation Reminder</a>
				</div>
			{/if}
			<p class="flow-page__copy">{donation.disclaimer}</p>
			<div class="flow-links">
				<a class="c-button c-button--primary" href="/join">Join the Herd</a>
				<a class="c-button c-button--secondary" href="/thanks?type=donate">I already donated</a>
			</div>
		</div>
	</div>
</section>
