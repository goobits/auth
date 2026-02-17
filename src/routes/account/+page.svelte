<script lang="ts">
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();
</script>

<svelte:head>
	<title>Account | pdx.run</title>
</svelte:head>

<section class="flow-page">
	<div class="layout__container">
		<div class="flow-page__card flow-page__card--narrow">
			<p class="layout__eyebrow">Account</p>
			<h1 class="layout__title">You are signed in</h1>
			<div class="flow-page__stack">
				<div class="flow-page__block">
					<h2 class="flow-page__block-title">Email</h2>
					<p class="flow-page__block-copy">{data.user.email}</p>
				</div>
			</div>
			<div class="flow-links">
				<form method="POST" action="/auth/sign-out">
					<button class="c-button c-button--secondary" type="submit">Sign Out</button>
				</form>
				<a class="c-button c-button--primary" href="/join">Join the Herd</a>
				<a class="c-button c-button--secondary" href="/">Back Home</a>
			</div>
		</div>
	</div>
</section>
