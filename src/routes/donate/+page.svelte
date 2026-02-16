<svelte:head>
	<title>Donate | pdx.run</title>
</svelte:head>

<section class="flow-page">
	<div class="layout__container">
		<div class="flow-page__card">
			<p class="layout__eyebrow">Support the event</p>
			<h1 class="layout__title">Donation options</h1>
			<p class="flow-page__copy">Choose your preferred donation method. Thank you for supporting a welcoming community event.</p>
			<div class="flow-links">
				<a class="c-button c-button--accent c-button--large" href="#online">Donate Online</a>
				<a class="c-button c-button--secondary" href="#venmo">Donate via Venmo</a>
				<a class="c-button c-button--secondary" href="#paypal">Donate via PayPal</a>
			</div>
			<div class="flow-page__stack">
				<section id="online" class="flow-page__block">
					<h2>Online</h2>
					<p>Primary checkout link goes here when your payment processor is finalized.</p>
				</section>
				<section id="venmo" class="flow-page__block">
					<h2>Venmo</h2>
					<p>Use your team Venmo profile URL and QR code for fast mobile donations.</p>
				</section>
				<section id="paypal" class="flow-page__block">
					<h2>PayPal</h2>
					<p>Use your PayPal donation URL and include it in social follow-up messages.</p>
				</section>
			</div>
			<p class="flow-page__copy">After donating, we recommend joining updates so you get route and weather notices.</p>
			<div class="flow-links">
				<a class="c-button c-button--primary" href="/join">Join the Herd</a>
				<a class="c-button c-button--secondary" href="/thanks?type=donate">I already donated</a>
			</div>
		</div>
	</div>
</section>
