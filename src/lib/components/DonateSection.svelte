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
				<h2 class="layout__title">{donation.headline}</h2>
				<p class="donate__copy">{donation.body}</p>
				<ul>
					{#each donation.bullets as bullet (bullet)}
						<li class="donate__item">{bullet}</li>
					{/each}
				</ul>
				<p class="donate__disclaimer">{donation.disclaimer}</p>
			</div>
			<div class="donate__actions">
				<a class="c-button c-button--primary" href={donation.onlineUrl}>Donate online</a>
				<a class="c-button c-button--secondary" href={donation.venmoUrl}>Donate via Venmo</a>
				<a class="c-button c-button--secondary" href={donation.paypalUrl}>Donate via PayPal</a>
			</div>
		</div>
	</div>
</section>
