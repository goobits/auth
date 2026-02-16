<script lang="ts">
	let { donation } = $props<{
		donation: {
			headline: string;
			body: string;
			bullets: string[];
			disclaimer: string;
			onlineUrl: string;
			venmoUrl: string;
			paypalUrl: string;
		};
	}>();
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
				<a class="c-button c-button--accent c-button--large" href={donation.onlineUrl}>Donate Online</a>
				<a class="c-button c-button--secondary" href={donation.venmoUrl}>Venmo</a>
				<a class="c-button c-button--secondary" href={donation.paypalUrl}>PayPal</a>
			</div>
		</div>
	</div>
</section>
