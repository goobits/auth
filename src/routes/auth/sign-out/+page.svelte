<svelte:head>
	<title>Sign Out | pdx.run</title>
</svelte:head>

<section class="flow-page">
	<div class="layout__container">
		<div class="flow-page__card flow-page__card--narrow">
			<p class="layout__eyebrow">Account</p>
			<h1 class="layout__title">Sign out</h1>
			<p class="flow-page__copy">You can sign back in any time.</p>
			<div class="flow-links">
				<form method="POST">
					<button class="c-button c-button--secondary" type="submit">Sign Out</button>
				</form>
				<a class="c-button c-button--primary" href="/account">Back to Account</a>
				<a class="c-button c-button--secondary" href="/">Back Home</a>
			</div>
		</div>
	</div>
</section>
